package com.supplypulse;

import com.supplypulse.Domain.*;
import com.supplypulse.Security.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final DataStore ds; private final AuthService auth;
    public ApiController(DataStore ds, AuthService auth) { this.ds = ds; this.auth = auth; }

    public record LoginRequest(String email, String password, String otp) {}
    public record ScenarioRequest(Integer demandSpikePct, Integer leadTimeWeeksAdded, Boolean supplierOutage) {}
    public record CloseRequest(String action) {}

    private Session s(HttpServletRequest r) { return (Session) r.getAttribute("session"); }
    private void need(HttpServletRequest r, String... roles) {
        if (!List.of(roles).contains(s(r).role())) throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "You can't do this.");
    }

    @PostMapping("/auth/login")
    public Map<String, Object> login(@RequestBody LoginRequest b) {
        String t = auth.login(b.email(), b.password(), b.otp());
        return Map.of("token", t, "role", auth.get(t).role(), "expiresInSeconds", 7200);
    }
    @PostMapping("/auth/logout") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest r) { auth.logout((String) r.getAttribute("token")); }
    @GetMapping("/me") public Session me(HttpServletRequest r) { return s(r); }

    @GetMapping("/items")
    public List<Map<String, Object>> items(@RequestParam(defaultValue = "") String q, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        int sz = Math.min(Math.max(size, 1), 100);
        return ds.items.stream().filter(i -> (i.name() + i.sku() + i.location()).toLowerCase().contains(q.toLowerCase()))
                .sorted(Comparator.comparing(Item::sku)).skip((long) page * sz).limit(sz).map(i -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("sku", i.sku()); m.put("name", i.name()); m.put("location", i.location()); m.put("onHand", i.onHand());
                    m.put("inbound", i.inbound()); m.put("ageDays", i.ageDays());
                    m.put("status", ds.coverRatio(i, 1, 0) < 1.2 ? "STOCK_OUT_RISK" : i.ageDays() > 45 ? "AGEING" : "HEALTHY");
                    return m;
                }).collect(Collectors.toList());
    }
    private Item item(String sku) { return ds.find(sku).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Item not found.")); }

    @GetMapping("/items/{sku}/forecast")
    public Map<String, Object> forecast(@PathVariable String sku) {
        Item i = item(sku);
        return Map.of("sku", sku, "history", i.history(), "forecast", i.forecast(), "wapePercent", i.wape(),
                "model", "seasonal blend (fallback: moving average)", "label", "AI forecast; planner can override");
    }

    @GetMapping("/replenishment")
    public List<Suggestion> replenishment() {
        return ds.items.stream().map(ds::suggest).filter(x -> x.quantity() > 0).collect(Collectors.toList());
    }
    @PostMapping("/replenishment/{sku}/approve")
    public Suggestion approve(@PathVariable String sku, HttpServletRequest r) {
        need(r, "PLANNER", "ADMIN");
        return ds.approve(item(sku), s(r).email());
    }

    @GetMapping("/shipments") public List<Shipment> shipments() { return ds.shipments; }
    @GetMapping("/suppliers") public List<Supplier> suppliers() { return ds.suppliers; }
    @GetMapping("/alerts") public List<Alert> alerts() { return ds.alerts; }
    @PostMapping("/alerts/{id}/claim")
    public Alert claim(@PathVariable String id, HttpServletRequest r) { Alert a = alert(id); a.owner = s(r).email(); return a; }
    @PostMapping("/alerts/{id}/close")
    public Alert close(@PathVariable String id, @RequestBody CloseRequest b) {
        if (b.action() == null || b.action().isBlank()) throw new ApiException(HttpStatus.BAD_REQUEST, "ACTION_REQUIRED", "Describe the action taken.");
        Alert a = alert(id); a.closed = true; a.action = b.action(); return a;
    }
    private Alert alert(String id) { return ds.alerts.stream().filter(a -> a.id.equals(id)).findFirst().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Alert not found.")); }

    @PostMapping("/scenarios")
    public Map<String, Object> scenario(@RequestBody ScenarioRequest b, HttpServletRequest r) {
        need(r, "PLANNER", "BUYER", "WAREHOUSE", "ADMIN");
        double spike = 1 + Math.max(0, Math.min(b.demandSpikePct() == null ? 0 : b.demandSpikePct(), 200)) / 100.0;
        int extra = Math.max(0, Math.min(b.leadTimeWeeksAdded() == null ? 0 : b.leadTimeWeeksAdded(), 8));
        boolean outage = Boolean.TRUE.equals(b.supplierOutage());
        long base = ds.items.stream().filter(i -> ds.coverRatio(i, 1, 0) < 1.2).count();
        List<String> atRisk = ds.items.stream().filter(i -> {
            Item x = outage && i.supplier().equals("Ganga Packaging")
                    ? new Item(i.sku(), i.name(), i.location(), i.onHand(), 0, i.leadWeeks(), i.supplier(), i.moq(), i.wape(), i.ageDays(), i.history(), i.forecast()) : i;
            return ds.coverRatio(x, spike, extra) < 1.2;
        }).map(Item::sku).collect(Collectors.toList());
        return Map.of("baselineAtRisk", base, "scenarioAtRisk", atRisk.size(), "scenarioAtRiskSkus", atRisk);
    }
}
