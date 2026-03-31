import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./contexts/AuthContext";
import { Toaster } from "sonner";


export default function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
    </>
  );
}