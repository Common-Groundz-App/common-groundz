
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  ChevronDown,
  User,
  Shield,
  Database,
  Key,
  Bug
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DebugInfo {
  timestamp: string;
  authState: {
    hasUser: boolean;
    hasSession: boolean;
    userEmail: string | null;
    sessionValid: boolean;
    tokenExpiry: string | null;
  };
  adminStatus: {
    clientSideCheck: boolean;
    serverSideCheck: boolean | null;
    emailDomain: string | null;
  };
  supabaseHealth: {
    canConnect: boolean;
    canQuery: boolean;
    error: string | null;
  };
  rlsPolicyTest: {
    canReadEntities: boolean;
    canUpdateEntities: boolean;
    specificError: string | null;
  };
}

export const AdminDebugPanel = () => {
  const { user, session, isLoading } = useAuth();
  const { toast } = useToast();
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const runDiagnostics = async () => {
    setRefreshing(true);
    console.log('AdminDebugPanel: Starting diagnostics...');
    
    try {
      const info: DebugInfo = {
        timestamp: new Date().toISOString(),
        authState: {
          hasUser: !!user,
          hasSession: !!session,
          userEmail: user?.email || null,
          sessionValid: false,
          tokenExpiry: null,
        },
        adminStatus: {
          clientSideCheck: false,
          serverSideCheck: null,
          emailDomain: null,
        },
        supabaseHealth: {
          canConnect: false,
          canQuery: false,
          error: null,
        },
        rlsPolicyTest: {
          canReadEntities: false,
          canUpdateEntities: false,
          specificError: null,
        }
      };

      // Test session validity
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        console.log('AdminDebugPanel: Session check result:', { sessionData, sessionError });
        
        if (sessionData.session) {
          info.authState.sessionValid = true;
          info.authState.tokenExpiry = new Date(sessionData.session.expires_at! * 1000).toISOString();
        }
      } catch (error) {
        console.error('AdminDebugPanel: Session check failed:', error);
      }

      // Test client-side admin check
      if (user?.email) {
        info.adminStatus.emailDomain = user.email.split('@')[1];
        info.adminStatus.clientSideCheck = user.email.endsWith('@lovable.dev');
      }

      // Test server-side admin check
      try {
        const { data: adminCheck, error: adminError } = await supabase.rpc('check_admin_permission');
        console.log('AdminDebugPanel: Server admin check result:', { adminCheck, adminError });
        
        if (adminError) {
          console.error('AdminDebugPanel: Admin RPC error:', adminError);
        } else {
          info.adminStatus.serverSideCheck = adminCheck;
        }
      } catch (error) {
        console.error('AdminDebugPanel: Admin RPC failed:', error);
      }

      // Test Supabase connectivity
      try {
        const { data, error } = await supabase.from('profiles').select('count').limit(1);
        console.log('AdminDebugPanel: Connectivity test result:', { data, error });
        
        info.supabaseHealth.canConnect = true;
        
        if (!error) {
          info.supabaseHealth.canQuery = true;
        } else {
          info.supabaseHealth.error = error.message;
        }
      } catch (error) {
        console.error('AdminDebugPanel: Connectivity test failed:', error);
        info.supabaseHealth.error = error instanceof Error ? error.message : 'Unknown error';
      }

      // Test RLS policies on entities
      try {
        // Test read permission
        const { data: readData, error: readError } = await supabase
          .from('entities')
          .select('id')
          .limit(1);
        
        console.log('AdminDebugPanel: Entities read test:', { readData, readError });
        info.rlsPolicyTest.canReadEntities = !readError;

        // Test update permission on a specific entity (if we have any)
        if (readData && readData.length > 0) {
          const testEntityId = readData[0].id;
          const { error: updateError } = await supabase
            .from('entities')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', testEntityId);
          
          console.log('AdminDebugPanel: Entities update test:', { updateError });
          info.rlsPolicyTest.canUpdateEntities = !updateError;
          
          if (updateError) {
            info.rlsPolicyTest.specificError = updateError.message;
          }
        }
      } catch (error) {
        console.error('AdminDebugPanel: RLS policy test failed:', error);
        info.rlsPolicyTest.specificError = error instanceof Error ? error.message : 'Unknown error';
      }

      setDebugInfo(info);
      console.log('AdminDebugPanel: Diagnostics complete:', info);
      
    } catch (error) {
      console.error('AdminDebugPanel: Diagnostics failed:', error);
      toast({
        title: 'Debug Error',
        description: 'Failed to run diagnostics. Check console for details.',
        variant: 'destructive'
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isLoading && (user || session)) {
      runDiagnostics();
    }
  }, [user, session, isLoading]);

  const getStatusIcon = (status: boolean | null) => {
    if (status === null) return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    return status ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusBadge = (status: boolean | null, trueText: string, falseText: string, nullText?: string) => {
    if (status === null) {
      return <Badge variant="outline" className="text-yellow-600">{nullText || 'Unknown'}</Badge>;
    }
    return status ? 
      <Badge variant="default" className="bg-green-100 text-green-800">{trueText}</Badge> : 
      <Badge variant="destructive">{falseText}</Badge>;
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bug className="h-5 w-5 text-orange-500" />
                  Admin Debug Panel
                </CardTitle>
                <CardDescription>
                  Authentication and permission diagnostics
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    runDiagnostics();
                  }}
                  disabled={refreshing}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {debugInfo ? (
              <>
                {/* Authentication State */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-500" />
                    <h3 className="font-semibold">Authentication State</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span>User Present:</span>
                      {getStatusIcon(debugInfo.authState.hasUser)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Session Valid:</span>
                      {getStatusIcon(debugInfo.authState.sessionValid)}
                    </div>
                    <div className="col-span-2">
                      <span>Email: </span>
                      <code className="bg-muted px-2 py-1 rounded text-xs">
                        {debugInfo.authState.userEmail || 'None'}
                      </code>
                    </div>
                    {debugInfo.authState.tokenExpiry && (
                      <div className="col-span-2">
                        <span>Token Expires: </span>
                        <code className="bg-muted px-2 py-1 rounded text-xs">
                          {new Date(debugInfo.authState.tokenExpiry).toLocaleString()}
                        </code>
                      </div>
                    )}
                  </div>
                </div>

                {/* Admin Status */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-purple-500" />
                    <h3 className="font-semibold">Admin Status</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Client-side Check:</span>
                      {getStatusBadge(debugInfo.adminStatus.clientSideCheck, 'Admin', 'Not Admin')}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Server-side Check:</span>
                      {getStatusBadge(debugInfo.adminStatus.serverSideCheck, 'Admin', 'Not Admin', 'Failed')}
                    </div>
                    {debugInfo.adminStatus.emailDomain && (
                      <div className="text-sm">
                        <span>Domain: </span>
                        <code className="bg-muted px-2 py-1 rounded text-xs">
                          @{debugInfo.adminStatus.emailDomain}
                        </code>
                      </div>
                    )}
                  </div>
                </div>

                {/* Supabase Health */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-green-500" />
                    <h3 className="font-semibold">Supabase Health</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Connection:</span>
                      {getStatusBadge(debugInfo.supabaseHealth.canConnect, 'Connected', 'Failed')}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Query Access:</span>
                      {getStatusBadge(debugInfo.supabaseHealth.canQuery, 'Working', 'Failed')}
                    </div>
                    {debugInfo.supabaseHealth.error && (
                      <div className="text-sm text-red-600">
                        <span>Error: </span>
                        <code className="bg-red-50 px-2 py-1 rounded text-xs">
                          {debugInfo.supabaseHealth.error}
                        </code>
                      </div>
                    )}
                  </div>
                </div>

                {/* RLS Policy Test */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-orange-500" />
                    <h3 className="font-semibold">RLS Policy Test (Entities)</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Read Permission:</span>
                      {getStatusBadge(debugInfo.rlsPolicyTest.canReadEntities, 'Allowed', 'Blocked')}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Update Permission:</span>
                      {getStatusBadge(debugInfo.rlsPolicyTest.canUpdateEntities, 'Allowed', 'Blocked')}
                    </div>
                    {debugInfo.rlsPolicyTest.specificError && (
                      <div className="text-sm text-red-600">
                        <span>RLS Error: </span>
                        <code className="bg-red-50 px-2 py-1 rounded text-xs">
                          {debugInfo.rlsPolicyTest.specificError}
                        </code>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                <div className="text-xs text-muted-foreground border-t pt-3">
                  Last updated: {new Date(debugInfo.timestamp).toLocaleString()}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {refreshing ? (
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Running diagnostics...
                  </div>
                ) : (
                  <div>
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Click Refresh to run diagnostics</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
