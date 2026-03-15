package dev.jobdog.backend.common.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.io.IOException;
import java.util.Collections;
import java.util.List;

@Converter
public class StringListConverter implements AttributeConverter<List<String>, String> {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> TYPE_REFERENCE = new TypeReference<>() {
    };

    @Override
    public String convertToDatabaseColumn(List<String> attribute) {
        try {
            return OBJECT_MAPPER.writeValueAsString(attribute == null ? Collections.emptyList() : attribute);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Unable to serialize string list", exception);
        }
    }

    @Override
    public List<String> convertToEntityAttribute(String dbData) {
        try {
            return dbData == null || dbData.isBlank()
                    ? Collections.emptyList()
                    : OBJECT_MAPPER.readValue(dbData, TYPE_REFERENCE);
        } catch (IOException exception) {
            throw new IllegalArgumentException("Unable to deserialize string list", exception);
        }
    }
}
