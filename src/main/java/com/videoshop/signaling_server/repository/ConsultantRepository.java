package com.videoshop.signaling_server.repository;

import com.videoshop.signaling_server.model.Consultant;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ConsultantRepository extends JpaRepository<Consultant, Long> {
    Optional<Consultant> findByUsername(String username);
    List<Consultant> findByStatus(Consultant.Status status);
}