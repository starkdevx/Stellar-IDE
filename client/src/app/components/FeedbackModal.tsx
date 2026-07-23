"use client";

import React, { useState } from "react";
import { X, Star, CheckCircle, MessageSquare } from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  addLog: (text: string, type?: "info" | "error" | "success" | "warning") => void;
}

type FeedbackType = "issue" | "feedback" | "feature_request";

export default function FeedbackModal({ isOpen, onClose, addLog }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>("feedback");
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleRatingClick = (r: number) => {
    setRating(r);
  };

  const resetForm = () => {
    setType("feedback");
    setRating(0);
    setHoverRating(0);
    setTitle("");
    setDescription("");
    setEmail("");
    setSubmitError(null);
    setIsSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Client-side Validation
    if (!title.trim()) {
      setSubmitError("Title is required.");
      return;
    }
    if (!description.trim()) {
      setSubmitError("Description is required.");
      return;
    }
    if (rating === 0) {
      setSubmitError("Please select a rating.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubmitError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          type,
          rating,
          email: email.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to submit feedback.");
      }

      setIsSuccess(true);
      addLog(`Feedback submitted successfully: ${title.trim()} (${type})`, "success");
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected error occurred.");
      addLog(`Failed to submit feedback: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="wallet-modal-overlay">
      <div className="wallet-modal-content" style={{ maxWidth: "460px" }}>
        <div className="wallet-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <MessageSquare size={18} style={{ color: "hsl(var(--accent-violet))" }} />
            <span className="wallet-modal-title">Share Your Feedback</span>
          </div>
          <button className="wallet-modal-close-btn" onClick={handleClose}>
            <X size={16} />
          </button>
        </div>

        <div className="wallet-modal-body" style={{ gap: "14px" }}>
          {isSuccess ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "30px 10px",
                textAlign: "center",
                gap: "16px",
              }}
            >
              <CheckCircle
                size={48}
                style={{
                  color: "hsl(var(--accent-success))",
                  animation: "pulse-glow 2s infinite ease-in-out",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <h4 style={{ fontSize: "1rem", fontWeight: "600", color: "#ffffff" }}>
                  Thank you!
                </h4>
                <p style={{ fontSize: "0.8rem", color: "hsl(var(--text-secondary))", lineHeight: "1.4" }}>
                  Your feedback has been submitted successfully and will help us improve Stellar IDE.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="btn btn-primary"
                style={{ marginTop: "8px", padding: "8px 24px", fontSize: "0.8rem" }}
              >
                Close Window
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {submitError && (
                <div
                  style={{
                    padding: "10px",
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    borderRadius: "6px",
                    color: "hsl(var(--accent-error))",
                    fontSize: "0.75rem",
                    lineHeight: "1.4",
                  }}
                >
                  {submitError}
                </div>
              )}

              {/* Feedback Category */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "hsl(var(--text-secondary))" }}>
                  Category
                </label>
                <div style={{ display: "flex", gap: "6px" }}>
                  {(["issue", "feedback", "feature_request"] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setType(cat)}
                      style={{
                        flex: 1,
                        background: type === cat ? "rgba(139, 92, 246, 0.12)" : "rgba(255, 255, 255, 0.02)",
                        border: type === cat ? "1px solid hsl(var(--accent-violet))" : "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "6px",
                        color: type === cat ? "#ffffff" : "hsl(var(--text-secondary))",
                        padding: "8px 4px",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        textTransform: "capitalize",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {cat.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Star Rating */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "hsl(var(--text-secondary))" }}>
                  Rating
                </label>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRatingClick(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: "4px",
                        cursor: "pointer",
                        outline: "none",
                        transition: "transform 0.1s ease",
                      }}
                      onMouseDown={(e) => {
                        e.currentTarget.style.transform = "scale(0.9)";
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      <Star
                        size={20}
                        fill={star <= (hoverRating || rating) ? "#eab308" : "transparent"}
                        color={star <= (hoverRating || rating) ? "#eab308" : "rgba(255, 255, 255, 0.2)"}
                        style={{
                          transition: "color 0.15s ease, fill 0.15s ease",
                        }}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <span style={{ fontSize: "0.72rem", color: "hsl(var(--text-muted))", marginLeft: "4px" }}>
                      ({rating} / 5)
                    </span>
                  )}
                </div>
              </div>

              {/* Title */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "hsl(var(--text-secondary))" }}>
                  Title
                </label>
                <input
                  type="text"
                  placeholder="Summarize your feedback"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  className="form-control"
                  style={{ fontSize: "0.78rem", padding: "8px 10px" }}
                />
              </div>

              {/* Description */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "hsl(var(--text-secondary))" }}>
                    Details
                  </label>
                  <span style={{ fontSize: "0.68rem", color: "hsl(var(--text-muted))" }}>
                    {description.length} / 500
                  </span>
                </div>
                <textarea
                  placeholder="Provide details about your experience or request..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={4}
                  className="form-control"
                  style={{
                    fontSize: "0.78rem",
                    padding: "8px 10px",
                    resize: "none",
                  }}
                />
              </div>

              {/* Email Address */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "hsl(var(--text-secondary))" }}>
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-control"
                  style={{ fontSize: "0.78rem", padding: "8px 10px" }}
                />
              </div>

              {/* Action Buttons */}
              <div className="wallet-modal-footer" style={{ padding: "10px 0 0 0", background: "transparent" }}>
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "hsl(var(--text-secondary))",
                    padding: "8px 16px",
                    fontSize: "0.78rem",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                  style={{
                    padding: "8px 24px",
                    fontSize: "0.78rem",
                    minWidth: "120px",
                  }}
                >
                  {isSubmitting ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div className="spinner" />
                      <span>Sending...</span>
                    </div>
                  ) : (
                    "Submit"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
