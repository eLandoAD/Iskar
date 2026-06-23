package com.videoshop.signaling_server.service;

import com.videoshop.signaling_server.model.CallSession;
import com.videoshop.signaling_server.model.Consultant;
import com.videoshop.signaling_server.repository.CallSessionRepository;
import com.videoshop.signaling_server.repository.ConsultantRepository;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedQueue;

@Service
public class QueueService {

    private final ConcurrentLinkedQueue<Map<String, String>> waitingQueue
            = new ConcurrentLinkedQueue<>();

    private final CallSessionRepository callSessionRepository;
    private final ConsultantRepository consultantRepository;
    private final ConsultantService consultantService;

    public QueueService(CallSessionRepository callSessionRepository,
                        ConsultantRepository consultantRepository,
                        ConsultantService consultantService) {
        this.callSessionRepository = callSessionRepository;
        this.consultantRepository = consultantRepository;
        this.consultantService = consultantService;
    }

    public String joinQueue(String sessionId, String sourcePage) {
        // Salva subito nel DB con status WAITING
        CallSession callSession = new CallSession();
        callSession.setSessionId(sessionId);
        callSession.setSourcePage(sourcePage);
        callSession.setStartTime(LocalDateTime.now());
        callSession.setStatus(CallSession.Status.WAITING);
        callSessionRepository.save(callSession);

        // Controlla se c'è un consulente disponibile
        Optional<Consultant> available = consultantService.findAvailable();
        if (available.isPresent()) {
            Consultant consultant = available.get();
            consultant.setStatus(Consultant.Status.BUSY);
            consultantRepository.save(consultant);

            callSession.setConsultantId(consultant.getId());
            callSession.setStatus(CallSession.Status.ACTIVE);
            callSessionRepository.save(callSession);

            return "assigned:" + consultant.getId();
        }

        // Nessun consulente disponibile — metti in coda
        Map<String, String> entry = new HashMap<>();
        entry.put("sessionId", sessionId);
        entry.put("sourcePage", sourcePage);
        waitingQueue.add(entry);

        return "waiting";
    }

    public List<Map<String, String>> getQueue() {
        return new ArrayList<>(waitingQueue);
    }

    public void removeFromQueue(String sessionId) {
        waitingQueue.removeIf(e -> sessionId.equals(e.get("sessionId")));
    }
}