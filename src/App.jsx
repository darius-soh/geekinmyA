// App.jsx — Main application with routing and context providers
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';

// Pages
import Onboarding from './pages/Onboarding';
import Homepage from './pages/Homepage';
import ForYou from './pages/ForYou';
import Guide from './pages/Guide';
import ArticleDetail from './pages/ArticleDetail';
import SearchPage from './pages/SearchPage';
import SearchResult from './pages/SearchResult';
import Settings from './pages/Settings';

// Layout components
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Protected route wrapper — redirects to onboarding if not authenticated
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/onboarding" replace />;
  return children;
}

// Layout with navbar and footer for authenticated pages
function AppLayout({ children }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}

// Router setup
function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Onboarding — no navbar/footer */}
      <Route
        path="/onboarding"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <Onboarding />
        }
      />

      {/* Protected routes with layout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout><Homepage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/for-you"
        element={
          <ProtectedRoute>
            <AppLayout><ForYou /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/guide"
        element={
          <ProtectedRoute>
            <AppLayout><Guide /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/article/:id"
        element={
          <ProtectedRoute>
            <AppLayout><ArticleDetail /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <AppLayout><SearchPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/search/result"
        element={
          <ProtectedRoute>
            <AppLayout><SearchResult /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AppLayout><Settings /></AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <AppRoutes />
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
