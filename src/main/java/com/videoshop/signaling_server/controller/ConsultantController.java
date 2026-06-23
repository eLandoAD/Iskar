package com.videoshop.signaling_server.controller;

import com.videoshop.signaling_server.model.Consultant;
import com.videoshop.signaling_server.service.ConsultantService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/consultants")
@CrossOrigin(origins = "*")
public class ConsultantController {

    private final ConsultantService consultantService;

    public ConsultantController(ConsultantService consultantService) {
        this.consultantService = consultantService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");
        return consultantService.login(username, password)
                .map(c -> ResponseEntity.ok(Map.of(
                        "id", c.getId(),
                        "username", c.getUsername(),
                        "status", c.getStatus()
                )))
                .orElse(ResponseEntity.status(401).build());
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        Consultant.Status status = Consultant.Status.valueOf(body.get("status"));
        Consultant updated = consultantService.updateStatus(id, status);
        return ResponseEntity.ok(Map.of(
                "id", updated.getId(),
                "status", updated.getStatus()
        ));
    }
}