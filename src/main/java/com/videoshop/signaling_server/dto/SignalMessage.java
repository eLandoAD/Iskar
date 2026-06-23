package com.videoshop.signaling_server.dto;

public class SignalMessage {

    private String type;
    private String sessionId;
    private String role;
    private Object payload;

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public Object getPayload() { return payload; }
    public void setPayload(Object payload) { this.payload = payload; }
}