package com.supplypulse;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.context.annotation.*;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.*;
import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class Security {
    public static class ApiException extends RuntimeException {
        public final HttpStatus status; public final String code;
        public ApiException(HttpStatus s, String code, String msg) { super(msg); this.status = s; this.code = code; }
    }
    public record Session(String email, String role, Instant expires) {}

    @Service
    public static class AuthService {
        private static final Map<String, String> USERS = Map.of("planner@acme.test", "PLANNER", "buyer@acme.test", "BUYER",
                "wh@acme.test", "WAREHOUSE", "exec@acme.test", "EXECUTIVE", "steward@acme.test", "STEWARD", "admin@acme.test", "ADMIN");
        private final Map<String, Session> sessions = new ConcurrentHashMap<>();
        private final Map<String, Integer> fails = new ConcurrentHashMap<>();
        private final Map<String, Instant> locked = new ConcurrentHashMap<>();

        /** Demo rules: invitation-only account, password >= 8 chars, any 6-digit code. Same error for every failure. */
        public String login(String email, String password, String otp) {
            String e = email == null ? "" : email.trim().toLowerCase();
            Instant until = locked.get(e);
            if (until != null && until.isAfter(Instant.now())) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "ACCOUNT_LOCKED", "Too many attempts. Try again later.");
            boolean ok = USERS.containsKey(e) && password != null && password.length() >= 8 && otp != null && otp.matches("\\d{6}");
            if (!ok) {
                if (fails.merge(e, 1, Integer::sum) >= 5) { locked.put(e, Instant.now().plusSeconds(900)); fails.remove(e); }
                throw new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "Email, password or code is incorrect.");
            }
            fails.remove(e);
            String token = UUID.randomUUID().toString();
            sessions.put(token, new Session(e, USERS.get(e), Instant.now().plusSeconds(7200)));
            return token;
        }
        public Session get(String token) {
            Session s = token == null ? null : sessions.get(token);
            if (s == null || s.expires().isBefore(Instant.now())) throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Sign in to continue.");
            return s;
        }
        public void logout(String token) { sessions.remove(token); }
    }

    @Configuration
    public static class WebConfig implements WebMvcConfigurer {
        private final AuthService auth;
        public WebConfig(AuthService auth) { this.auth = auth; }
        @Override public void addInterceptors(InterceptorRegistry reg) {
            reg.addInterceptor(new HandlerInterceptor() {
                @Override public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object h) {
                    String hdr = req.getHeader("Authorization");
                    String token = hdr != null && hdr.startsWith("Bearer ") ? hdr.substring(7) : null;
                    req.setAttribute("session", auth.get(token));
                    req.setAttribute("token", token);
                    return true;
                }
            }).addPathPatterns("/api/**").excludePathPatterns("/api/auth/login");
        }
    }

    @Component
    public static class CorrelationFilter extends OncePerRequestFilter {
        @Override protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
            String id = UUID.randomUUID().toString();
            req.setAttribute("traceId", id);
            res.setHeader("X-Correlation-Id", id);
            chain.doFilter(req, res);
        }
    }
}
