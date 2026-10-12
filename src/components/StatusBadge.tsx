import React from "react";

export interface StatusBadgeConfig {
  bg: string;
  text: string;
  border: string;
  dotColor: string;
  shadow: string;
  icon: string;
}

export function getStatusBadgeConfig(status: string, stage: number = 0): StatusBadgeConfig {
  const normStatus = (status || "").trim();

  // 1. Graduated / Finalized
  if (normStatus === "Graduate") {
    return {
      bg: "#ecfdf5",
      text: "#065f46",
      border: "#10b981",
      dotColor: "#10b981",
      shadow: "0 2px 8px rgba(16, 185, 129, 0.28)",
      icon: "🎓"
    };
  }

  // 2. Revise (High Urgency Alert)
  if (normStatus === "Revise") {
    return {
      bg: "#fef2f2",
      text: "#991b1b",
      border: "#ef4444",
      dotColor: "#ef4444",
      shadow: "0 2px 8px rgba(239, 68, 68, 0.28)",
      icon: "⚠️"
    };
  }

  // 3. Pending Signatures (Stages 3 to 5)
  if (normStatus.startsWith("Pending Sign. Advisor")) {
    return {
      bg: "#fff7ed",
      text: "#9a3412",
      border: "#f97316",
      dotColor: "#f97316",
      shadow: "0 2px 8px rgba(249, 115, 22, 0.26)",
      icon: "✒️"
    };
  }

  if (normStatus.startsWith("Pending Sign. Committee")) {
    return {
      bg: "#faf5ff",
      text: "#6b21a8",
      border: "#a855f7",
      dotColor: "#a855f7",
      shadow: "0 2px 8px rgba(168, 85, 247, 0.26)",
      icon: "🖊️"
    };
  }

  if (normStatus.startsWith("Pending Sign. Chairperson")) {
    return {
      bg: "#f0fdfa",
      text: "#0f766e",
      border: "#14b8a6",
      dotColor: "#14b8a6",
      shadow: "0 2px 8px rgba(20, 184, 166, 0.26)",
      icon: "🖋️"
    };
  }

  // 4. Pending Reviews (Stages 0 to 2)
  if (normStatus.startsWith("Pending Advisor")) {
    return {
      bg: "#fffbeb",
      text: "#92400e",
      border: "#f59e0b",
      dotColor: "#f59e0b",
      shadow: "0 2px 8px rgba(245, 158, 11, 0.26)",
      icon: "⏳"
    };
  }

  if (normStatus.startsWith("Pending Committee")) {
    return {
      bg: "#f5f3ff",
      text: "#5b21b6",
      border: "#8b5cf6",
      dotColor: "#8b5cf6",
      shadow: "0 2px 8px rgba(139, 92, 246, 0.26)",
      icon: "👥"
    };
  }

  if (normStatus.startsWith("Pending Chairperson")) {
    return {
      bg: "#f0f9ff",
      text: "#0369a1",
      border: "#0284c7",
      dotColor: "#0284c7",
      shadow: "0 2px 8px rgba(2, 132, 199, 0.26)",
      icon: "👨‍⚖️"
    };
  }

  // 5. Preparing (Differentiated vividly by stage)
  if (normStatus === "Preparing") {
    switch (stage) {
      case 0:
        return {
          bg: "#eff6ff",
          text: "#1d4ed8",
          border: "#3b82f6",
          dotColor: "#3b82f6",
          shadow: "0 2px 8px rgba(37, 99, 235, 0.24)",
          icon: "📝"
        };
      case 1:
        return {
          bg: "#f5f3ff",
          text: "#6d28d9",
          border: "#8b5cf6",
          dotColor: "#8b5cf6",
          shadow: "0 2px 8px rgba(124, 58, 237, 0.24)",
          icon: "👥"
        };
      case 2:
        return {
          bg: "#f0f9ff",
          text: "#0284c7",
          border: "#0ea5e9",
          dotColor: "#0ea5e9",
          shadow: "0 2px 8px rgba(2, 132, 199, 0.24)",
          icon: "👨‍⚖️"
        };
      case 3:
        return {
          bg: "#fff7ed",
          text: "#c2410c",
          border: "#f97316",
          dotColor: "#f97316",
          shadow: "0 2px 8px rgba(234, 88, 12, 0.24)",
          icon: "✒️"
        };
      case 4:
        return {
          bg: "#faf5ff",
          text: "#7e22ce",
          border: "#a855f7",
          dotColor: "#a855f7",
          shadow: "0 2px 8px rgba(147, 51, 234, 0.24)",
          icon: "🖊️"
        };
      case 5:
        return {
          bg: "#f0fdfa",
          text: "#0f766e",
          border: "#14b8a6",
          dotColor: "#14b8a6",
          shadow: "0 2px 8px rgba(13, 148, 136, 0.24)",
          icon: "🖋️"
        };
      case 6:
        return {
          bg: "#ecfdf5",
          text: "#065f46",
          border: "#10b981",
          dotColor: "#10b981",
          shadow: "0 2px 8px rgba(16, 185, 129, 0.28)",
          icon: "🎓"
        };
      default:
        return {
          bg: "#f1f5f9",
          text: "#334155",
          border: "#64748b",
          dotColor: "#64748b",
          shadow: "0 2px 6px rgba(100, 116, 139, 0.2)",
          icon: "📝"
        };
    }
  }

  // Fallback for any other custom status
  return {
    bg: "#f8fafc",
    text: "#334155",
    border: "#94a3b8",
    dotColor: "#64748b",
    shadow: "0 2px 6px rgba(15, 23, 42, 0.12)",
    icon: "📄"
  };
}

export interface StatusBadgeProps {
  status: string;
  stage?: number;
  displayStatus?: string;
  showIcon?: boolean;
  showDot?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
}

export default function StatusBadge({
  status,
  stage = 0,
  displayStatus,
  showIcon = true,
  showDot = true,
  size = "md",
  className,
  style
}: StatusBadgeProps) {
  const config = getStatusBadgeConfig(status, stage);
  const label = displayStatus || status;

  let padding = "4px 11px";
  let fontSize = "0.82rem";
  let gap = "6px";
  let dotSize = "7px";

  if (size === "sm") {
    padding = "3px 9px";
    fontSize = "0.78rem";
    gap = "5px";
    dotSize = "6px";
  } else if (size === "lg") {
    padding = "7px 16px";
    fontSize = "0.92rem";
    gap = "8px";
    dotSize = "8px";
  }

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: gap,
        padding: padding,
        background: config.bg,
        color: config.text,
        border: `1.5px solid ${config.border}`,
        borderRadius: "9999px",
        fontSize: fontSize,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        boxShadow: config.shadow,
        lineHeight: 1.25,
        whiteSpace: "nowrap",
        userSelect: "none",
        transition: "all 0.18s ease",
        ...style
      }}
    >
      {showDot && (
        <span
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: "50%",
            backgroundColor: config.dotColor,
            boxShadow: `0 0 6px ${config.dotColor}`,
            display: "inline-block",
            flexShrink: 0
          }}
        />
      )}
      {showIcon && (
        <span style={{ fontSize: "1em", lineHeight: 1, display: "inline-flex", alignItems: "center" }}>
          {config.icon}
        </span>
      )}
      <span>{label}</span>
    </span>
  );
}
