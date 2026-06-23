package com.videoshop.signaling_server.controller;

import com.videoshop.signaling_server.dto.SignalMessage;
import com.videoshop.signaling_server.registry.SessionRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
@CrossOrigin(origins = "*")
public class FileController {

    private final SessionRegistry registry;
    private final ObjectMapper mapper = new ObjectMapper();

    public FileController(SessionRegistry registry) {
        this.registry = registry;
    }

    @PostMapping("/upload")
    public ResponseEntity<?> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("sessionId") String sessionId) throws Exception {

        String uploadDir = "uploads/" + sessionId + "/";
        new File(uploadDir).mkdirs();
        String filename = System.currentTimeMillis() + "_" + file.getOriginalFilename();
        Path path = Paths.get(uploadDir + filename);
        Files.write(path, file.getBytes());

        String fileUrl = "/uploads/" + sessionId + "/" + filename;

        WebSocketSession consultantSession = registry.getOther(sessionId, "customer");
        if (consultantSession != null && consultantSession.isOpen()) {
            SignalMessage msg = new SignalMessage();
            msg.setType("file-meta");
            msg.setSessionId(sessionId);
            msg.setRole("server");
            msg.setPayload(Map.of("url", fileUrl, "name", file.getOriginalFilename()));
            consultantSession.sendMessage(new TextMessage(mapper.writeValueAsString(msg)));
        }

        return ResponseEntity.ok(Map.of("url", fileUrl, "name", file.getOriginalFilename()));
    }
}