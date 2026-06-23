package com.videoshop.signaling_server.controller;

import com.videoshop.signaling_server.service.QueueService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/queue")
@CrossOrigin(origins = "*")
public class QueueController {

    private final QueueService queueService;

    public QueueController(QueueService queueService) {
        this.queueService = queueService;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, String>>> getQueue() {
        return ResponseEntity.ok(queueService.getQueue());
    }
}