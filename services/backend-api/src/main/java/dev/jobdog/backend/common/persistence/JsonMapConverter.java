package dev.jobdog.backend.common.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.io.IOException;
import java.util.Collections;
import java.util.Map;

@Converter
public class JsonMapConverter implements AttributeConverter<Map<String, Object>, String> {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> TYPE_REFERENCE = new TypeReference<>() {
    };

    @Override
    public String convertToDatabaseColumn(Map<String, Object> attribute) {
        try {
            return OBJECT_MAPPER.writeValueAsString(attribute == null ? Collections.emptyMap() : attribute);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Unable to serialize JSON map", exception);
        }
    }

    @Override
    public Map<String, Object> convertToEntityAttribute(String dbData) {
        try {
            return dbData == null || dbData.isBlank()
                    ? Collections.emptyMap()
                    : OBJECT_MAPPER.readValue(dbData, TYPE_REFERENCE);
        } catch (IOException exception) {
            throw new IllegalArgumentException("Unable to deserialize JSON map", exception);
        }
    }
}
