import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RMEDIA MindBunker",
    short_name: "MindBunker",
    description: "Private CRM and daily operating dashboard",
    start_url: "/mindbunker/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait-primary",
  };
}
