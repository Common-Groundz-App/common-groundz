import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { NavBarComponent } from '@/components/NavBarComponent';
import Footer from '@/components/Footer';
import { ACCOUNT_RECOVERY_POLICY } from '@/config/authConfig';
import { UserX, Mail, Calendar, Home, AlertTriangle, ArrowRight, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AccountDeleted = () => {
  const { toast } = useToast();
  const supportEmail = ACCOUNT_RECOVERY_POLICY.supportEmail;
  const mailtoHref = `mailto:${supportEmail}?subject=${encodeURIComponent('Account Recovery Request')}&body=${encodeURIComponent(
    `Hi Common Groundz Support,\n\nI recently deleted my account and would like to request recovery.\n\nEmail associated with my account: [please fill in]\n\nThank you.`
  )}`;

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(supportEmail);
      toast({ title: 'Email copied to clipboard' });
    } catch {
      toast({
        title: "Couldn't copy",
        description: `Please email ${supportEmail} manually`,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavBarComponent />

      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <UserX className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Account Deleted</h1>
            <p className="text-muted-foreground">
              Your account has been successfully deactivated.
            </p>
          </div>

          {/* Recovery window card */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-medium text-base">30-day recovery window</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your data is retained for {ACCOUNT_RECOVERY_POLICY.windowDays} days. During this period, you can recover your account by contacting our support team.
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex gap-2">
                  <Button asChild className="flex-1 gap-2">
                    <a href={mailtoHref}>
                      <Mail className="h-4 w-4" />
                      Contact Support to Recover
                    </a>
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleCopyEmail} title="Copy email address">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {supportEmail}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* OAuth warning */}
          <Card className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-medium">Want to create a new account?</p>
                  <p className="text-muted-foreground">
                    Signing in with the same email (including Google) will detect your deleted account, not create a new one. Use a <span className="font-medium text-foreground">different email</span> to register, or contact support to recover this account.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/">
                <Home className="h-4 w-4" />
                Back to Home
              </Link>
            </Button>

            <Button asChild variant="link" size="sm" className="gap-1 text-muted-foreground">
              <Link to="/auth">
                Create account with a different email
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AccountDeleted;
