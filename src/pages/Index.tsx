import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  MapPin, 
  Users, 
  BarChart3, 
  Shield, 
  Smartphone,
  Clock,
  Zap,
  TrendingUp,
  Package,
  DollarSign,
  Layout
} from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-hero py-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="text-center">
            <Badge className="mb-4 bg-accent text-accent-foreground hover:bg-accent-hover">
              Enterprise Task Management System
            </Badge>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-primary-foreground mb-6 animate-fade-in">
              Welcome to TaskVision
            </h1>
            <p className="text-xl sm:text-2xl text-primary-foreground/90 mb-8 max-w-3xl mx-auto">
              Comprehensive task management with real-time collaboration, location tracking, and advanced analytics
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="accent" size="lg" className="text-lg">
                Get Started
              </Button>
              <Button variant="outline" size="lg" className="text-lg bg-white/10 text-white border-white/20 hover:bg-white/20">
                View Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-subtle">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Powerful Features</h2>
            <p className="text-xl text-muted-foreground">Everything you need to manage tasks efficiently</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Task Management */}
            <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary">
              <CardHeader>
                <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Task Management</CardTitle>
                <CardDescription>
                  Create, assign, and track tasks with priority levels and multi-employee support
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Location Tracking */}
            <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-accent">
              <CardHeader>
                <div className="w-12 h-12 bg-accent-light rounded-lg flex items-center justify-center mb-4">
                  <MapPin className="w-6 h-6 text-accent" />
                </div>
                <CardTitle>Location Tracking</CardTitle>
                <CardDescription>
                  Real-time GPS tracking with geofencing and location-based task assignments
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Team Collaboration */}
            <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-success">
              <CardHeader>
                <div className="w-12 h-12 bg-success-light rounded-lg flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-success" />
                </div>
                <CardTitle>Team Collaboration</CardTitle>
                <CardDescription>
                  Real-time chat, notifications, and activity feeds for seamless collaboration
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Analytics */}
            <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary">
              <CardHeader>
                <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Advanced Analytics</CardTitle>
                <CardDescription>
                  Comprehensive reporting with performance metrics and data insights
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Security */}
            <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-warning">
              <CardHeader>
                <div className="w-12 h-12 bg-warning-light rounded-lg flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-warning" />
                </div>
                <CardTitle>Enterprise Security</CardTitle>
                <CardDescription>
                  Role-based access control with comprehensive permission management
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Mobile Ready */}
            <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-accent">
              <CardHeader>
                <div className="w-12 h-12 bg-accent-light rounded-lg flex items-center justify-center mb-4">
                  <Smartphone className="w-6 h-6 text-accent" />
                </div>
                <CardTitle>Mobile Optimized</CardTitle>
                <CardDescription>
                  PWA support with offline functionality and native mobile app capabilities
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* New Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-accent text-accent-foreground">Coming Soon</Badge>
            <h2 className="text-4xl font-bold mb-4">Enhanced Management Systems</h2>
            <p className="text-xl text-muted-foreground">New powerful features to streamline your operations</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Petty Cash Management */}
            <Card className="hover:shadow-xl transition-all duration-300 border-2 border-primary/20">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center mb-4">
                  <DollarSign className="w-8 h-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-2xl">Petty Cash Management</CardTitle>
                <CardDescription className="text-base">
                  Complete expense tracking and approval workflow system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                    <span>Digital receipt management with OCR extraction</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                    <span>Multi-level approval workflows</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                    <span>Budget management and tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                    <span>Automated reimbursement processing</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Inventory Management */}
            <Card className="hover:shadow-xl transition-all duration-300 border-2 border-accent/20">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-accent rounded-xl flex items-center justify-center mb-4">
                  <Package className="w-8 h-8 text-accent-foreground" />
                </div>
                <CardTitle className="text-2xl">Geofenced Inventory Management</CardTitle>
                <CardDescription className="text-base">
                  Smart inventory tracking with location-based automation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                    <span>Real-time stock monitoring across locations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                    <span>Automated alerts for stock movements</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                    <span>GPS-enabled stock counting</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                    <span>Route-optimized distribution</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-5xl font-bold mb-2">99.9%</div>
              <div className="text-primary-foreground/80">Uptime</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">24/7</div>
              <div className="text-primary-foreground/80">Support</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">Real-time</div>
              <div className="text-primary-foreground/80">Updates</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">Enterprise</div>
              <div className="text-primary-foreground/80">Security</div>
            </div>
          </div>
        </div>
      </section>

      {/* Departments Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-subtle">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Designed for Every Department</h2>
            <p className="text-xl text-muted-foreground">Tailored solutions for your entire organization</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              "Finance Department",
              "Operations Department",
              "Production Department",
              "HR & Admin Department",
              "Sales & Marketing",
              "QS",
              "Design",
              "Procurement"
            ].map((dept) => (
              <Card key={dept} className="text-center hover:shadow-lg transition-all hover:scale-105 bg-gradient-primary">
                <CardHeader>
                  <CardTitle className="text-base text-primary-foreground">{dept}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Transform Your Task Management?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of teams already using TaskVision to streamline their operations
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="lg" className="text-lg">
              Start Free Trial
            </Button>
            <Button variant="outline" size="lg" className="text-lg">
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t py-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-semibold mb-2">TaskVision</p>
            <p>Enterprise-grade task management system © 2025</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
