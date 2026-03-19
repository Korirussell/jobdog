package dev.jobdog.backend.resume;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class PdfTextExtractor {

    private static final Logger log = LoggerFactory.getLogger(PdfTextExtractor.class);

    public String extractText(byte[] pdfBytes) {
        // Primary extraction: standard text stripper
        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            String text = stripper.getText(document);
            if (text != null && text.trim().length() > 50) {
                log.debug("PDF text extraction succeeded: {} chars", text.length());
                return text;
            }
            // If we got very little text, the PDF may be image-based or have encoding issues
            log.warn("PDF text extraction returned minimal text ({} chars) — using raw fallback",
                    text == null ? 0 : text.trim().length());
            return text == null ? "" : text;
        } catch (IOException e) {
            log.error("PDFBox extraction failed: {} — attempting lenient load", e.getMessage());
        }

        // Fallback: try loading with recovery mode
        try (PDDocument document = Loader.loadPDF(pdfBytes, (String) null)) {
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(document);
            log.info("Lenient PDF load succeeded: {} chars", text == null ? 0 : text.length());
            return text == null ? "" : text;
        } catch (IOException e2) {
            log.error("Lenient PDF load also failed: {}", e2.getMessage());
            // Return empty string rather than throwing — let the AI handle it gracefully
            return "";
        }
    }
}
