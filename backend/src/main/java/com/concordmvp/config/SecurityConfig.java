package com.concordmvp.config;

import com.concordmvp.auth.JwtAuthFilter;
import com.concordmvp.servers.ServerIconUploadSizeFilter;
import com.concordmvp.users.AvatarUploadSizeFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final RestAuthenticationEntryPoint restAuthenticationEntryPoint;
    private final AvatarUploadSizeFilter avatarUploadSizeFilter;
    private final ServerIconUploadSizeFilter serverIconUploadSizeFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter, RestAuthenticationEntryPoint restAuthenticationEntryPoint,
                           AvatarUploadSizeFilter avatarUploadSizeFilter,
                           ServerIconUploadSizeFilter serverIconUploadSizeFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.restAuthenticationEntryPoint = restAuthenticationEntryPoint;
        this.avatarUploadSizeFilter = avatarUploadSizeFilter;
        this.serverIconUploadSizeFilter = serverIconUploadSizeFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(httpBasic -> httpBasic.disable())
                .formLogin(formLogin -> formLogin.disable())
                .exceptionHandling(exceptionHandling -> exceptionHandling.authenticationEntryPoint(restAuthenticationEntryPoint))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(
                                "/api/v1/auth/register",
                                "/api/v1/auth/login",
                                "/api/v1/auth/logout",
                                "/api/v1/auth/verify-email",
                                "/api/v1/auth/forgot-password",
                                "/api/v1/auth/reset-password/verify",
                                "/api/v1/auth/reset-password",
                                // Spring Boot forwards here internally whenever a request handler throws —
                                // that forward re-enters this filter chain as its own dispatch. Without this,
                                // an unauthenticated caller who hits any error sees this filter's generic 401
                                // instead of the real status/body BasicErrorController would have rendered,
                                // masking the actual failure.
                                "/error",
                                "/actuator/health",
                                "/ws",
                                "/api/v1/invites/**"
                        ).permitAll()
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(avatarUploadSizeFilter, JwtAuthFilter.class)
                .addFilterBefore(serverIconUploadSizeFilter, JwtAuthFilter.class);

        return http.build();
    }
}
