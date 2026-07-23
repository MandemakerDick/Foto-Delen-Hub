import { motion } from "framer-motion";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Heart, MessageCircle } from "lucide-react";
import type { Photo } from "@workspace/api-client-react";

export function PhotoCard({ photo, index }: { photo: Photo; index?: number }) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index ? index * 0.05 : 0 }}
      className="group flex flex-col gap-3"
    >
      <Link href={`/photos/${photo.id}`} className="block relative aspect-[4/5] overflow-hidden bg-muted rounded-sm">
        <img
          src={photo.imageUrl}
          alt={photo.title}
          className="block object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
        {(photo.commentCount ?? 0) > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 text-white text-xs font-mono px-2 py-1 rounded-full backdrop-blur-sm">
            <MessageCircle className="w-3 h-3" />
            <span>{photo.commentCount}</span>
          </div>
        )}
      </Link>

      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-start">
          <h3 className="font-serif font-medium text-lg leading-tight line-clamp-1">{photo.title}</h3>
          <div className="flex items-center gap-3 text-muted-foreground text-xs font-mono">
            <div className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              <span>{photo.likeCount || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              <span>{photo.commentCount ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <Link href={`/photographers/${photo.photographerId}`} className="hover:text-primary transition-colors">
            {photo.photographerName || t("common.unknown")}
          </Link>
          {photo.clubName && (
            <Link href={`/clubs/${photo.clubId}`} className="text-xs uppercase tracking-wider hover:text-foreground transition-colors">
              {photo.clubName}
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}
