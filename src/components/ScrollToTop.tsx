"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 150) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <button
      onClick={scrollToTop}
      style={{
        position: "fixed",
        bottom: "32px",
        right: "32px",
        width: "44px",
        height: "44px",
        borderRadius: "50%",
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(8px)",
        color: "var(--primary-color)",
        border: "1.5px solid var(--border-color)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "var(--shadow-md)",
        zIndex: 9999,
        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(16px)",
      }}
      aria-label="Scroll to top"
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--primary-color)";
        e.currentTarget.style.color = "#ffffff";
        e.currentTarget.style.borderColor = "var(--primary-color)";
        e.currentTarget.style.transform = "translateY(-3px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
        e.currentTarget.style.color = "var(--primary-color)";
        e.currentTarget.style.borderColor = "var(--border-color)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <ChevronUp size={20} />
    </button>
  );
}
