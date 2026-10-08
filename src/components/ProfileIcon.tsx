"use client";

import { useState, useRef } from "react";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateUser } from "@/lib/db/users";

interface ProfileIconProps {
  dbUser: any;
  user: any;
  defaultLetter?: string;
  size?: string;
}

export default function ProfileIcon({ dbUser, user, defaultLetter = "U", size = "38px" }: ProfileIconProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initial = (dbUser?.name_th || user?.email || defaultLetter)[0].toUpperCase();
  const profileImageUrl = dbUser?.profileImageUrl;

  const handleIconClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!dbUser || !dbUser.id) {
      alert("User record not found in database. Cannot upload image.");
      return;
    }

    try {
      setUploading(true);
      const storageRef = ref(storage, `profile_images/${dbUser.id}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      await updateUser(dbUser.id, { profileImageUrl: url });
      
      window.location.reload();
    } catch (error) {
      console.error("Error uploading profile image:", error);
      alert("Failed to upload image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div 
        onClick={handleIconClick}
        style={{ 
          width: size, 
          height: size, 
          borderRadius: "50%", 
          background: profileImageUrl ? "transparent" : "var(--primary-color)", 
          color: "#ffffff", 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center", 
          fontWeight: 700, 
          fontSize: "0.95rem", 
          flexShrink: 0,
          cursor: "pointer",
          backgroundImage: profileImageUrl ? `url(${profileImageUrl})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "relative",
          overflow: "hidden",
          border: profileImageUrl ? "2px solid var(--primary-border)" : "2px solid #ffffff",
          boxShadow: "0 2px 8px rgba(99, 102, 241, 0.2)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
        }}
        title="Click to change profile picture"
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.35)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 2px 8px rgba(99, 102, 241, 0.2)";
        }}
      >
        {!profileImageUrl && !uploading && initial}
        {uploading && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <span style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }}></span>
          </div>
        )}
      </div>
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        style={{ display: "none" }} 
        onChange={handleFileChange}
      />
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
