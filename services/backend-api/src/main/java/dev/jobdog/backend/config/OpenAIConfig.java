package dev.jobdog.backend.config;

import com.theokanning.openai.service.OpenAiService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class OpenAIConfig {

    @Bean
    public OpenAiService openAiService(OpenAIProperties properties) {
        return new OpenAiService(properties.apiKey(), Duration.ofSeconds(60));
    }
}
