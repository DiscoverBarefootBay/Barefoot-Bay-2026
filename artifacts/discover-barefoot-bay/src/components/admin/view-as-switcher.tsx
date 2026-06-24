import { useState, useEffect } from "react";
import { Eye, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const ROLE_LABELS: Record<string, string> = {
  [UserRole.GUEST]: "Guest",
  [UserRole.REGISTERED]: "Registered",
  [UserRole.BADGE_HOLDER]: "Badge Holder",
  [UserRole.PAID]: "Paid Member",
  [UserRole.MODERATOR]: "Moderator",
  [UserRole.ADMIN]: "Admin",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  [UserRole.GUEST]: "Non-logged in users",
  [UserRole.REGISTERED]: "Basic registered users",
  [UserRole.BADGE_HOLDER]: "Members with badges",
  [UserRole.PAID]: "Paid subscribers",
  [UserRole.MODERATOR]: "Community moderators",
  [UserRole.ADMIN]: "Full administrators",
};

const COLLAPSED_STORAGE_KEY = 'barefootbay-view-as-collapsed';

export function ViewAsSwitcher() {
  const { actualRole, effectiveRole, setViewAsRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (stored !== null) {
        return stored === 'true';
      }
    }
    return true;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(COLLAPSED_STORAGE_KEY, isCollapsed.toString());
    }
  }, [isCollapsed]);

  if (actualRole !== UserRole.ADMIN) {
    return null;
  }

  const isViewingAsOther = effectiveRole !== actualRole;

  const allRoles = [
    UserRole.GUEST,
    UserRole.REGISTERED,
    UserRole.BADGE_HOLDER,
    UserRole.PAID,
    UserRole.MODERATOR,
    UserRole.ADMIN,
  ];

  const handleCollapseToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
    setIsOpen(false);
  };

  return (
    <div 
      className="fixed bottom-4 left-4 z-50"
      data-testid="view-as-switcher"
    >
      <motion.div
        initial={false}
        animate={{
          width: isCollapsed ? '48px' : 'auto',
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
        className="relative"
      >
        {!isCollapsed && (
          <button
            onClick={handleCollapseToggle}
            className="absolute -top-2 -right-2 z-10 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-full p-1 shadow-md border border-slate-200 dark:border-slate-600"
            data-testid="collapse-view-as"
            title="Collapse"
          >
            <X className="h-3 w-3 text-slate-600 dark:text-slate-300" />
          </button>
        )}
        
        <DropdownMenu open={isOpen && !isCollapsed} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant={isViewingAsOther ? "default" : "secondary"}
              className={`
                relative flex items-center gap-2 shadow-lg overflow-hidden
                ${isViewingAsOther 
                  ? "bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-700" 
                  : "bg-slate-700 hover:bg-slate-800 text-white dark:bg-slate-600 dark:hover:bg-slate-700"
                }
                ${isCollapsed ? 'w-12 h-12 p-0 justify-center' : ''}
              `}
              data-testid="view-as-button"
              onClick={isCollapsed ? handleCollapseToggle : undefined}
            >
              <Eye className={`h-4 w-4 ${isCollapsed ? '' : 'flex-shrink-0'}`} />
              
              <AnimatePresence mode="wait">
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2 overflow-hidden whitespace-nowrap"
                  >
                    <span className="text-sm font-medium">
                      Viewing As: {ROLE_LABELS[effectiveRole]}
                    </span>
                    {isViewingAsOther && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewAsRole(null);
                        }}
                        className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                        data-testid="clear-view-as"
                        title="Reset to Admin view"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="start" 
            className="w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Select Role to View As
            </div>
            {allRoles.map((role) => (
              <DropdownMenuItem
                key={role}
                onClick={() => {
                  setViewAsRole(role === actualRole ? null : role);
                  setIsOpen(false);
                }}
                className={`
                  cursor-pointer
                  ${effectiveRole === role 
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100" 
                    : "text-slate-700 dark:text-slate-200"
                  }
                `}
                data-testid={`role-option-${role}`}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{ROLE_LABELS[role]}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {ROLE_DESCRIPTIONS[role]}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>

      <AnimatePresence>
        {isViewingAsOther && !isCollapsed && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-2 text-xs text-amber-800 dark:text-amber-200 overflow-hidden"
          >
            <strong>Testing Mode:</strong> You're viewing the site as a {ROLE_LABELS[effectiveRole]}.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
