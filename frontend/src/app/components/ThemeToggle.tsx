import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Solo renderizar el contenido del botón cuando se monta en el cliente
  // Esto evita errores de hidratación cuando el servidor y el cliente tienen diferentes temas
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="invisible">
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      </Button>
    );
  }

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
      aria-label="Cambiar tema"
      title="Cambiar tema"
    >
      {isDark ? (
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem]" />
      )}
    </Button>
  );
}
