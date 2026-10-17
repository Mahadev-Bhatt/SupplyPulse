package com.supplypulse;

public final class Domain {
    private Domain() {}
    public record Item(String sku, String name, String location, int onHand, int inbound, int leadWeeks,
                       String supplier, int moq, int wape, int ageDays, int[] history, int[] forecast) {}
    public record Shipment(String id, String supplier, String to, String status, boolean exception, String note) {}
    public record Supplier(String name, int onTime, int quality, int costTrend) {}
    public record Suggestion(String sku, String item, int quantity, String reasoning, String status, String approvedBy) {}
    public static class Alert {
        public String id, text, severity, owner, action;
        public boolean closed;
        public Alert(String id, String text, String severity) { this.id = id; this.text = text; this.severity = severity; }
    }
}
