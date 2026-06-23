package com.videoshop.signaling_server.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videoshop.signaling_server.dto.SignalMessage;
import com.videoshop.signaling_server.model.CallSession;
import com.videoshop.signaling_server.model.Consultant;
import com.videoshop.signaling_server.registry.SessionRegistry;
import com.videoshop.signaling_server.repository.CallSessionRepository;
import com.videoshop.signaling_server.repository.ConsultantRepository;
import com.videoshop.signaling_server.service.QueueService;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import java.time.LocalDateTime;
import java.util.Optional;

@Component
public class SignalingHandler extends TextWebSocketHandler {

    private final SessionRegistry registry;
    private final ObjectMapper mapper = new ObjectMapper();
    private final QueueService queueService;
    private final CallSessionRepository callSessionRepository;
    private final ConsultantRepository consultantRepository;

    public SignalingHandler(SessionRegistry registry,
                            QueueService queueService,
                            CallSessionRepository callSessionRepository,
                            ConsultantRepository consultantRepository) {
        this.registry = registry;
        this.queueService = queueService;
        this.callSessionRepository = callSessionRepository;
        this.consultantRepository = consultantRepository;
    }

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message)
            throws Exception {

        SignalMessage msg = mapper.readValue(message.getPayload(), SignalMessage.class);
        String sessionId = msg.getSessionId();
        String role = msg.getRole();

        registry.register(sessionId, role, session);

        if ("queue-join".equals(msg.getType())) {
            String sourcePage = msg.getPayload() != null ? msg.getPayload().toString() : "unknown";
            String result = queueService.joinQueue(sessionId, sourcePage);

            SignalMessage response = new SignalMessage();
            response.setSessionId(sessionId);
            response.setRole("server");

            if (result.startsWith("assigned:")) {
                response.setType("assigned");
                response.setPayload(result.replace("assigned:", ""));
            } else {
                response.setType("waiting");
                response.setPayload("Connecting you to a consultant...");
            }
            session.sendMessage(new TextMessage(mapper.writeValueAsString(response)));
            return;
        }

        if ("end-call".equals(msg.getType())) {
            Optional<CallSession> callSession = callSessionRepository.findBySessionId(sessionId);
            callSession.ifPresent(cs -> {
                cs.setEndTime(LocalDateTime.now());
                cs.setStatus(CallSession.Status.ENDED);
                callSessionRepository.save(cs);
                if (cs.getConsultantId() != null) {
                    consultantRepository.findById(cs.getConsultantId()).ifPresent(c -> {
                        c.setStatus(Consultant.Status.ONLINE);
                        consultantRepository.save(c);
                    });
                }
            });
            WebSocketSession other = registry.getOther(sessionId, role);
            if (other != null && other.isOpen()) {
                other.sendMessage(new TextMessage(mapper.writeValueAsString(msg)));
            }
            registry.remove(sessionId, role);
            return;
        }

        if ("leave".equals(msg.getType())) {
            registry.remove(sessionId, role);
            queueService.removeFromQueue(sessionId);
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
                        callSessionRepository.findBySessionId(sessionId).ifPresent(cs -> {
                            if (cs.getStatus() == CallSession.Status.WAITING) {
                                cs.setStatus(CallSession.Status.MISSED);
                            } else if (cs.getStatus() == CallSession.Status.ACTIVE) {
                                cs.setStatus(CallSession.Status.ENDED);
                                cs.setEndTime(LocalDateTime.now());
                            }
                            callSessionRepository.save(cs);
                            if (cs.getConsultantId() != null) {
                                consultantRepository.findById(cs.getConsultantId()).ifPresent(c -> {
                                    c.setStatus(Consultant.Status.ONLINE);
                                    consultantRepository.save(c);
                                });
                            }
                        });

                        queueService.removeFromQueue(sessionId);

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