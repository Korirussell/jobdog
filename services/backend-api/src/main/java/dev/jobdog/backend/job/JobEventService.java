package dev.jobdog.backend.job;

import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;

@Service
public class JobEventService implements MessageListener {

    private static final String CHANNEL = "new-jobs";

    private final StringRedisTemplate redisTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    public JobEventService(StringRedisTemplate redisTemplate,
                           SimpMessagingTemplate messagingTemplate,
                           ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.messagingTemplate = messagingTemplate;
        this.objectMapper = objectMapper;
    }

    public void publishNewJob(JobSummaryResponse job) {
        try {
            String json = objectMapper.writeValueAsString(job);
            redisTemplate.convertAndSend(CHANNEL, json);
        } catch (Exception e) {
            throw new RuntimeException("Failed to publish job event", e);
        }
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String payload = new String(message.getBody());
        messagingTemplate.convertAndSend("/topic/new-jobs", payload);
    }
}
