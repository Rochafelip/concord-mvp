package com.concordmvp.common;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GlobalExceptionHandlerTest {

    @Mock
    private HttpServletRequest request;

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void handlesMalformedRequestBody_as400() {
        when(request.getRequestURI()).thenReturn("/api/v1/auth/register");
        HttpMessageNotReadableException ex = mock(HttpMessageNotReadableException.class);

        ResponseEntity<ApiError> response = handler.handleMalformedRequest(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().message()).isEqualTo("Corpo da requisição inválido");
        assertThat(response.getBody().path()).isEqualTo("/api/v1/auth/register");
    }

    @Test
    void handlesTypeMismatch_as400() {
        when(request.getRequestURI()).thenReturn("/api/v1/servers/not-a-uuid");
        MethodArgumentTypeMismatchException ex = mock(MethodArgumentTypeMismatchException.class);

        ResponseEntity<ApiError> response = handler.handleTypeMismatch(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().message()).isEqualTo("Parâmetro inválido");
        assertThat(response.getBody().path()).isEqualTo("/api/v1/servers/not-a-uuid");
    }
    @Test
    void translatesFieldNamesToPortugueseLabels() {
        when(request.getRequestURI()).thenReturn("/api/v1/auth/register");

        ResponseEntity<ApiError> response =
                handler.handleValidation(validationExceptionFor("password", "deve ter entre 8 e 100 caracteres"), request);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().message()).isEqualTo("Senha: deve ter entre 8 e 100 caracteres");
    }

    @Test
    void fallsBackToTheRawFieldNameWhenThereIsNoLabel() {
        when(request.getRequestURI()).thenReturn("/api/v1/auth/register");

        // A field added later without a label must degrade to its raw name, never blow up.
        ResponseEntity<ApiError> response =
                handler.handleValidation(validationExceptionFor("someNewField", "é obrigatório"), request);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().message()).isEqualTo("someNewField: é obrigatório");
    }

    private MethodArgumentNotValidException validationExceptionFor(String field, String message) {
        BindingResult bindingResult = mock(BindingResult.class);
        when(bindingResult.getFieldErrors()).thenReturn(List.of(new FieldError("request", field, message)));
        MethodArgumentNotValidException exception = mock(MethodArgumentNotValidException.class);
        when(exception.getBindingResult()).thenReturn(bindingResult);
        return exception;
    }
}
