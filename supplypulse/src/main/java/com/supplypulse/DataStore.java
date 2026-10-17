package com.supplypulse;

import com.supplypulse.Domain.*;
import org.springframework.stereotype.Service;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** In-memory data and the planning rules. Replace with a database and ERP/IoT adapters. */
@Service
public class DataStore {
    private static final String[] NAMES = {"Cotton tee M", "Rice 5kg", "PET bottle 1L", "Carton 40x30", "Tea 250g", "Glass jar 500ml", "Steel flask", "Wrap film"};
    private static final String[] LOCS = {"Mumbai DC", "Delhi DC", "Agra Hub"};
    public final List<Supplier> suppliers = List.of(new Supplier("Kaveri Textiles", 94, 98, 2), new Supplier("Himalaya Foods", 81, 96, -1),
            new Supplier("Deccan Plastics", 88, 91, 4), new Supplier("Ganga Packaging", 72, 89, 6));
    public final List<Item> items = new ArrayList<>();
    public final List<Shipment> shipments = List.of(
            new Shipment("SH-3301", "Kaveri Textiles", "Mumbai DC", "In transit", false, "+1 d late"),
            new Shipment("SH-3302", "Himalaya Foods", "Delhi DC", "In transit", false, "On time"),
            new Shipment("SH-3303", "Deccan Plastics", "Agra Hub", "Delayed", true, "+3 d late"),
            new Shipment("SH-3304", "Ganga Packaging", "Mumbai DC", "Cold chain", true, "Temperature 11C, limit 8C"),
            new Shipment("SH-3305", "Himalaya Foods", "Agra Hub", "Route deviation", true, "Off route 42 km"));
    public final List<Alert> alerts = new ArrayList<>();
    private final Map<String, String> approvals = new ConcurrentHashMap<>();

    public DataStore() {
        Random r = new Random(7);
        for (int i = 0; i < NAMES.length; i++) {
            int base = 60 + r.nextInt(140);
            int[] h = new int[12], f = new int[6];
            for (int w = 0; w < 12; w++) h[w] = (int) Math.round(base * (1 + .25 * Math.sin(w / 2.0 + i)) + r.nextInt(20) - 10);
            for (int w = 0; w < 6; w++) f[w] = (int) Math.round(base * (1 + .25 * Math.sin((w + 12) / 2.0 + i)));
            items.add(new Item("SKU-" + (1001 + i), NAMES[i], LOCS[i % 3], (int) (base * (.6 + r.nextDouble() * 2.2)),
                    (int) (base * r.nextDouble()), 1 + r.nextInt(4), suppliers.get(i % 4).name(), 50, 6 + r.nextInt(14), 5 + r.nextInt(70), h, f));
        }
        int k = 10;
        for (Shipment s : shipments) if (s.exception()) alerts.add(new Alert("AL-" + k++, s.id() + ": " + s.status() + " - " + s.note(), "High"));
        for (Item i : items) if (coverRatio(i, 1, 0) < 1.2) alerts.add(new Alert("AL-" + k++, i.name() + " at " + i.location() + ": stock-out risk", "Medium"));
    }

    public int demandOverLead(Item i, double spike, int extraLead) {
        double d = 0;
        for (int w = 0; w <= Math.min(5, i.leadWeeks() + extraLead); w++) d += i.forecast()[w] * spike;
        return (int) Math.round(d);
    }
    public int safetyStock(Item i) { return (int) Math.ceil(Math.sqrt(i.leadWeeks() + 1) * i.wape() * 1.65 * i.forecast()[0] / 60.0); }
    public double coverRatio(Item i, double spike, int extraLead) {
        double perWeek = Math.max(1, demandOverLead(i, spike, extraLead) / (double) (i.leadWeeks() + extraLead + 1));
        return (i.onHand() + i.inbound()) / perWeek;
    }
    public Suggestion suggest(Item i) {
        int need = demandOverLead(i, 1, 0) + safetyStock(i) - i.onHand() - i.inbound();
        int qty = need > 0 ? Math.max(i.moq(), (int) Math.ceil(need / 10.0) * 10) : 0;
        String why = "demand over lead time %d + safety %d - on hand %d - inbound %d; supplier %s, MOQ %d"
                .formatted(demandOverLead(i, 1, 0), safetyStock(i), i.onHand(), i.inbound(), i.supplier(), i.moq());
        String by = approvals.get(i.sku());
        return new Suggestion(i.sku(), i.name(), qty, why, by == null ? "PENDING_APPROVAL" : "APPROVED", by);
    }
    /** Idempotent: approving twice returns the first approval. */
    public Suggestion approve(Item i, String user) { approvals.putIfAbsent(i.sku(), user); return suggest(i); }
    public Optional<Item> find(String sku) { return items.stream().filter(i -> i.sku().equals(sku)).findFirst(); }
}
