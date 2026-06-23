package com.videoshop.signaling_server.service;

import com.videoshop.signaling_server.model.Consultant;
import com.videoshop.signaling_server.repository.ConsultantRepository;
import org.springframework.stereotype.Service;
import java.util.Optional;

@Service
public class ConsultantService {

    private final ConsultantRepository consultantRepository;

    public ConsultantService(ConsultantRepository consultantRepository) {
        this.consultantRepository = consultantRepository;
    }

    public Optional<Consultant> login(String username, String password) {
        Optional<Consultant> consultant = consultantRepository.findByUsername(username);
        if (consultant.isPresent() && consultant.get().getPasswordHash().equals(password)) {
            return consultant;
        }
        return Optional.empty();
    }

    public Consultant updateStatus(Long id, Consultant.Status status) {
        Consultant consultant = consultantRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Consultant not found"));
        consultant.setStatus(status);
        return consultantRepository.save(consultant);
    }

    public Optional<Consultant> findAvailable() {
        return consultantRepository
                .findByStatus(Consultant.Status.ONLINE)
                .stream()
                .findFirst();
    }
}