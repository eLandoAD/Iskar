package com.videoshop.signaling_server.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videoshop.signaling_server.dto.SignalMessage;
import com.videoshop.signaling_server.registry.SessionRegistry;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class SignalingHandler extends TextWebSocketHandler {

    private final SessionRegistry registry;
    private final ObjectMapper mapper = new ObjectMapper();

    public SignalingHandler(SessionRegistry registry) {
        this.registry = registry;
    }

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message)
            throws Exception {

        SignalMessage msg = mapper.readValue(message.getPayload(), SignalMessage.class);
        String sessionId = msg.getSessionId();
        String role = msg.getRole();

        registry.register(sessionId, role, session);

        if ("leave".equals(msg.getType())) {
            registry.remove(sessionId, role);
            WebSocketSession other = registry.getOther(sessionId, role);
            if (other != null && other.isOpen()) {
                other.sendMessage(new TextMessage(mapper.writeValueAsString(msg)));
            }
            return;
        }

        WebSocketSession other = registry.getOther(sessionId, role);
        if (other != null && other.isOpen()) {
            other.sendMessage(new TextMessage(mapper.writeValueAsString(msg)));
        } else {
            SignalMessage err = new SignalMessage();
            err.setType("error");
            err.setSessionId(sessionId);
            err.setRole("server");
            err.setPayload("Altro partecipante non ancora connesso");
            session.sendMessage(new TextMessage(mapper.writeValueAsString(err)));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        registry.getAll().forEach((sessionId, room) ->
                room.entrySet().removeIf(entry -> {
                    if (entry.getValue().getId().equals(session.getId())) {
                        String otherRole = "consultant".equals(entry.getKey()) ? "customer" : "consultant";
                        WebSocketSession other = room.get(otherRole);
                        if (other != null && other.isOpen()) {
                            try {
                                SignalMessage left = new SignalMessage();
                                left.setType("leave");
                                left.setSessionId(sessionId);
                                left.setRole(entry.getKey());
                                other.sendMessage(new TextMessage(mapper.writeValueAsString(left)));
                            } catch (Exception ignored) {}
                        }
                        return true;
                    }
                    return false;
                })
        );
    }
}