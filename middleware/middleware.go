package middleware

import (
	"context"
	"hospitalOPD/model"
	"hospitalOPD/utils/httpResp"
	"net/http"
)

// Context keys — used to pass session data to handlers via request context
// Using a custom type avoids key collisions with other packages
type contextKey string

const (
	ContextKeySession contextKey = "session"
)

// AuthMiddleware checks that a valid session cookie exists
// If valid, attaches the session to the request context and calls next handler
// If invalid or missing, returns 401
func AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Read session cookie
		cookie, err := r.Cookie("session_token")
		if err != nil {
			httpResp.RespondWithError(w, http.StatusUnauthorized, "not logged in")
			return
		}

		// Fetch session from DB — returns nil if expired or not found
		session, err := model.GetSession(cookie.Value)
		if err != nil || session == nil {
			httpResp.RespondWithError(w, http.StatusUnauthorized, "session expired or invalid — please log in again")
			return
		}

		// Attach session to request context so handlers can read it
		ctx := context.WithValue(r.Context(), ContextKeySession, session)
		next(w, r.WithContext(ctx))
	}
}

// RequireRole wraps AuthMiddleware and also checks the session role
// Use this to protect routes that only one role should access
// Example: RequireRole("admin", handler) — only admins can call this
func RequireRole(role string, next http.HandlerFunc) http.HandlerFunc {
	return AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		// Session is already validated by AuthMiddleware — just read it from context
		session := GetSessionFromContext(r)
		if session == nil {
			httpResp.RespondWithError(w, http.StatusUnauthorized, "not logged in")
			return
		}

		// Check role matches
		if session.Role != role {
			httpResp.RespondWithError(w, http.StatusForbidden, "access denied — insufficient permissions")
			return
		}

		next(w, r)
	})
}

// GetSessionFromContext is a helper used inside handlers to read the session
// Returns nil if no session in context
func GetSessionFromContext(r *http.Request) *model.Session {
	session, ok := r.Context().Value(ContextKeySession).(*model.Session)
	if !ok {
		return nil
	}
	return session
}