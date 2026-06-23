package com.videoshop.signaling_server.repository;

import com.videoshop.signaling_server.model.CallSession;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CallSessionRepository extends JpaRepository<CallSession, Long> {
    Optional<CallSession> findBySessionId(String sessionId);
    List<CallSession> findByStatus(CallSession.Status status);
    List<CallSession> findByConsultantId(Long consultantId);
}