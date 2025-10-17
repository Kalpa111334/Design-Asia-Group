import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, CheckCircle2, Loader2, Sparkles, Zap, Lock, Globe } from 'lucide-react';

const SplashScreen = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const steps = [
    { icon: Globe, text: 'Initializing System', color: 'text-blue-300' },
    { icon: Lock, text: 'Securing Connection', color: 'text-green-300' },
    { icon: Zap, text: 'Loading Modules', color: 'text-yellow-300' },
    { icon: CheckCircle2, text: 'Ready to Launch', color: 'text-emerald-300' }
  ];

  useEffect(() => {
    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 40);

    // Step animation
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= steps.length - 1) {
          clearInterval(stepInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 500);

    // Show splash screen for 2.5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setLoading(false);
    }, 2500);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
      clearInterval(stepInterval);
    };
  }, []);

  useEffect(() => {
    if (!loading && !authLoading) {
      // Small delay for smooth transition
      const redirectTimer = setTimeout(() => {
        try {
          if (user) {
            navigate('/dashboard');
          } else {
            navigate('/auth');
          }
        } catch (error) {
          console.error('Navigation error:', error);
          // Fallback to home page
          navigate('/');
        }
      }, 500);

      return () => clearTimeout(redirectTimer);
    }
  }, [loading, authLoading, user, navigate]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white/20 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 4}s`
            }}
          />
        ))}
        
        {/* Large floating orbs */}
        <div className="absolute -top-60 -right-60 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full animate-float-slow blur-3xl"></div>
        <div className="absolute -bottom-60 -left-60 w-80 h-80 bg-gradient-to-tr from-cyan-400/20 to-blue-400/20 rounded-full animate-float-slow-reverse blur-3xl"></div>
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-gradient-to-br from-indigo-400/20 to-purple-400/20 rounded-full animate-float-slow delay-1000 blur-2xl"></div>
      </div>

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      ></div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center space-y-6 sm:space-y-8 md:space-y-12 max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Logo with enhanced animation */}
        <div className="relative group">
          {/* Outer glow rings */}
          <div className="absolute inset-0 w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 bg-gradient-to-r from-blue-400/30 to-purple-400/30 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute inset-2 w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28 bg-gradient-to-r from-cyan-400/20 to-blue-400/20 rounded-full blur-lg animate-pulse delay-300"></div>
          
          {/* Main logo container */}
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-br from-white via-blue-50 to-blue-100 rounded-2xl sm:rounded-3xl shadow-2xl flex items-center justify-center animate-logo-bounce group-hover:scale-110 transition-transform duration-300">
            <Shield className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-blue-600 animate-pulse" />
            {/* Inner sparkle effect */}
            <Sparkles className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 animate-sparkle" />
          </div>
          
          {/* Rotating border */}
          <div className="absolute inset-0 w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 border-2 border-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 rounded-2xl sm:rounded-3xl animate-spin-slow opacity-60"></div>
        </div>

        {/* App branding with enhanced typography */}
        <div className="text-center space-y-2 sm:space-y-3 md:space-y-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-cyan-200 animate-title-glow leading-tight">
            TaskVision
          </h1>
          <div className="flex items-center justify-center space-x-1 sm:space-x-2">
            <div className="w-4 sm:w-6 md:w-8 h-0.5 bg-gradient-to-r from-transparent to-blue-400"></div>
            <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-light text-blue-200 animate-fade-in-delay">
              Enterprise Management
            </p>
            <div className="w-4 sm:w-6 md:w-8 h-0.5 bg-gradient-to-l from-transparent to-blue-400"></div>
          </div>
          <p className="text-sm sm:text-base md:text-lg text-blue-300/80 animate-fade-in-delay-2">
            Streamline • Secure • Scale
          </p>
        </div>

        {/* Enhanced loading section */}
        <div className="w-full max-w-sm sm:max-w-md space-y-4 sm:space-y-6">
          {/* Current step indicator */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 animate-fade-in-delay-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={index}
                  className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all duration-500 ${
                    index <= currentStep
                      ? 'bg-white/10 backdrop-blur-sm border border-white/20'
                      : 'opacity-30'
                  }`}
                >
                  <Icon className={`w-3 h-3 sm:w-4 sm:h-4 ${step.color} ${index <= currentStep ? 'animate-pulse' : ''}`} />
                  <span className="text-white/80 text-xs sm:text-sm font-medium hidden sm:inline">{step.text}</span>
                </div>
              );
            })}
          </div>

          {/* Enhanced progress bar */}
          <div className="relative">
            <div className="w-full h-1.5 sm:h-2 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
              <div 
                className="h-full bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 rounded-full transition-all duration-300 ease-out relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
              </div>
            </div>
            <div className="flex justify-between mt-1.5 sm:mt-2 text-xs text-white/60">
              <span>Loading</span>
              <span className="font-mono">{progress}%</span>
            </div>
          </div>

          {/* Loading spinner with enhanced animation */}
          <div className="flex items-center justify-center space-x-2 sm:space-x-3 animate-fade-in-delay-4">
            <div className="relative">
              <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-spin" />
              <div className="absolute inset-0 w-5 h-5 sm:w-6 sm:h-6 border-2 border-transparent border-t-blue-400 rounded-full animate-spin-slow"></div>
            </div>
            <span className="text-white/80 text-sm sm:text-lg font-medium">Preparing your workspace...</span>
          </div>
        </div>

        {/* Enhanced status indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 animate-fade-in-delay-5">
          {[
            { icon: CheckCircle2, text: 'System Ready', color: 'text-emerald-400' },
            { icon: Lock, text: 'Secure Access', color: 'text-blue-400' },
            { icon: Zap, text: 'High Performance', color: 'text-yellow-400' },
            { icon: Globe, text: 'Global Sync', color: 'text-cyan-400' }
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                <Icon className={`w-3 h-3 sm:w-4 sm:h-4 ${item.color} animate-pulse`} />
                <span className="text-white/80 text-xs sm:text-sm">{item.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enhanced CSS animations */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fade-in-delay {
          0% { opacity: 0; transform: translateY(30px); }
          50% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fade-in-delay-2 {
          0% { opacity: 0; transform: translateY(30px); }
          60% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fade-in-delay-3 {
          0% { opacity: 0; transform: translateY(30px); }
          70% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fade-in-delay-4 {
          0% { opacity: 0; transform: translateY(30px); }
          80% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fade-in-delay-5 {
          0% { opacity: 0; transform: translateY(30px); }
          85% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes logo-bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0) scale(1); }
          10% { transform: translateY(-10px) scale(1.05); }
          30% { transform: translateY(-5px) scale(1.02); }
        }
        
        @keyframes title-glow {
          0%, 100% { text-shadow: 0 0 20px rgba(59, 130, 246, 0.5); }
          50% { text-shadow: 0 0 30px rgba(59, 130, 246, 0.8), 0 0 40px rgba(147, 51, 234, 0.3); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.7; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 1; }
        }
        
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(-30px) translateX(10px); }
          66% { transform: translateY(15px) translateX(-5px); }
        }
        
        @keyframes float-slow-reverse {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(20px) translateX(-10px); }
          66% { transform: translateY(-25px) translateX(5px); }
        }
        
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .animate-fade-in {
          animation: fade-in 1s ease-out forwards;
        }
        
        .animate-fade-in-delay {
          animation: fade-in-delay 1.5s ease-out forwards;
        }
        
        .animate-fade-in-delay-2 {
          animation: fade-in-delay-2 2s ease-out forwards;
        }
        
        .animate-fade-in-delay-3 {
          animation: fade-in-delay-3 2.5s ease-out forwards;
        }
        
        .animate-fade-in-delay-4 {
          animation: fade-in-delay-4 3s ease-out forwards;
        }
        
        .animate-fade-in-delay-5 {
          animation: fade-in-delay-5 3.5s ease-out forwards;
        }
        
        .animate-logo-bounce {
          animation: logo-bounce 2s ease-in-out infinite;
        }
        
        .animate-title-glow {
          animation: title-glow 3s ease-in-out infinite;
        }
        
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        
        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite;
        }
        
        .animate-float-slow-reverse {
          animation: float-slow-reverse 10s ease-in-out infinite;
        }
        
        .animate-sparkle {
          animation: sparkle 2s ease-in-out infinite;
        }
        
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        
        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
