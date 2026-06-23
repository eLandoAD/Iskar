package com.videoshop.signaling_server.controller;

import com.videoshop.signaling_server.model.CallSession;
import com.videoshop.signaling_server.model.Consultant;
import com.videoshop.signaling_server.repository.CallSessionRepository;
import com.videoshop.signaling_server.repository.ConsultantRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/calls")
@CrossOrigin(origins = "*")
public class CallController {

    private final CallSessionRepository callSessionRepository;
    private final ConsultantRepository consultantRepository;

    public CallController(CallSessionRepository callSessionRepository,
                          ConsultantRepository consultantRepository) {
        this.callSessionRepository = callSessionRepository;
        this.consultantRepository = consultantRepository;
    }

    @PostMapping("/{sessionId}/end")
    public ResponseEntity<?> endCall(@PathVariable String sessionId) {
        return callSessionRepository.findBySessionId(sessionId)
                .map(session -> {
                    session.setEndTime(LocalDateTime.now());
                    session.setStatus(CallSession.Status.ENDED);
                    callSessionRepository.save(session);

                    if (session.getConsultantId() != null) {
                        consultantRepository.findById(session.getConsultantId())
                                .ifPresent(c -> {
                                    c.setStatus(Consultant.Status.ONLINE);
                                    consultantRepository.save(c);
                                });
                    }
                    return ResponseEntity.ok(Map.of("status", "ended"));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<CallSession>> getAllCalls() {
        return ResponseEntity.ok(callSessionRepository.findAll());
    }

    @GetMapping("/export")
    public ResponseEntity<String> exportCsv() {
        List<CallSession> calls = callSessionRepository.findAll();
        StringBuilder csv = new StringBuilder();
        csv.append("id,sessionId,consultantId,sourcePage,startTime,endTime,status\n");
        for (CallSession c : calls) {
            csv.append(c.getId()).append(",")
                    .append(c.getSessionId()).append(",")
                    .append(c.getConsultantId()).append(",")
                    .append(c.getSourcePage()).append(",")
                    .append(c.getStartTime()).append(",")
                    .append(c.getEndTime()).append(",")
                    .append(c.getStatus()).append("\n");
        }
        return ResponseEntity.ok()
                .header("Content-Type", "text/csv")
                .header("Content-Disposition", "attachment; filename=calls.csv")
                .body(csv.toString());
    }

    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Object>> getMetrics() {
        List<CallSession> all = callSessionRepository.findAll();
        long total = all.size();
        long active = all.stream().filter(c -> c.getStatus() == CallSession.Status.ACTIVE).count();
        long missed = all.stream().filter(c -> c.getStatus() == CallSession.Status.MISSED).count();
        long ended = all.stream().filter(c -> c.getStatus() == CallSession.Status.ENDED).count();

        return ResponseEntity.ok(Map.of(
                "total", total,
                "active", active,
                "missed", missed,
                "ended", ended
        ));
    }
}