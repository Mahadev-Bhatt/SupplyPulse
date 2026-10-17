package com.supplypulse;

import com.supplypulse.Security.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.*;

/** One error body everywhere: timestamp, status, errorCode, message, path, traceId. */
@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> api(ApiException e, HttpServletRequest r) { return body(e.status, e.code, e.getMessage(), r); }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> other(Exception e, HttpServletRequest r) {
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Something went wrong. Quote the trace id to support.", r);
    }
    private ResponseEntity<Map<String, Object>> body(HttpStatus s, String code, String msg, HttpServletRequest r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("timestamp", Instant.now().toString()); m.put("status", s.value()); m.put("errorCode", code);
        m.put("message", msg); m.put("path", r.getRequestURI()); m.put("traceId", r.getAttribute("traceId"));
        return ResponseEntity.status(s).body(m);
    }
}
