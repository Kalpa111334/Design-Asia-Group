import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { X, Shield } from 'lucide-react';

interface NoAccessProps {
  title?: string;
  message?: string;
  resource?: string;
}

const NoAccess: React.FC<NoAccessProps> = ({ 
  title = "No Access", 
  message = "You do not have permission to access this page.",
  resource 
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center space-y-6">
            {/* Large Red X Icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <X className="w-12 h-12 text-red-600 dark:text-red-400" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>

            {/* Big Red Title */}
            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-red-600 dark:text-red-400">
                {title}
              </h1>
              {resource && (
                <p className="text-lg font-semibold text-muted-foreground">
                  {resource}
                </p>
              )}
            </div>

            {/* Message */}
            <div className="space-y-3">
              <p className="text-muted-foreground text-lg">
                {message}
              </p>
              
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-700 dark:text-red-300">
                  <strong>Access Denied:</strong> Your current role does not have permission to view or interact with this resource.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                onClick={() => window.history.back()}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NoAccess;
