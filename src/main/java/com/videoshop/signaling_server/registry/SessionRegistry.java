package com.videoshop.signaling_server.registry;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SessionRegistry {

    private final ConcurrentHashMap<String, Map<String, WebSocketSession>> sessions
            = new ConcurrentHashMap<>();

    public void register(String sessionId, String role, WebSocketSession ws) {
        sessions
                .computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>())
                .put(role, ws);
    }

    public void remove(String sessionId, String role) {
        Map<String, WebSocketSession> room = sessions.get(sessionId);
        if (room != null) {
            room.remove(role);
            if (room.isEmpty()) sessions.remove(sessionId);
        }
    }

    public WebSocketSession getOther(String sessionId, String role) {
        Map<String, WebSocketSession> room = sessions.get(sessionId);
        if (room == null) return null;
        String otherRole = "consultant".equals(role) ? "customer" : "consultant";
        return room.get(otherRole);
    }

    public Map<String, Map<String, WebSocketSession>> getAll() {
        return sessions;
    }
}