import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/layouts/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { 
  Trash2, 
  Search, 
  MessageSquare,
  User,
  Clock,
  Mail,
  Filter,
  Eye,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";

interface MessageSender {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
}

interface MessageRecipient {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  readAt: string | null;
  status: string | null;
}

interface MessageAttachment {
  id: string;
  filename: string;
  url: string;
  size: string;
  contentType: string;
}

interface AdminMessage {
  id: number;
  subject: string;
  content: string;
  senderId: number;
  messageType: string;
  inReplyTo: number | null;
  deletedAt: string | null;
  deletedBySender: boolean;
  createdAt: string;
  updatedAt: string;
  sender: MessageSender;
  recipients: MessageRecipient[];
  attachments: MessageAttachment[];
}

export default function AdminMessagesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<AdminMessage | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast({
        title: "Access Denied",
        description: "You need admin privileges to access this page.",
        variant: "destructive",
      });
      return;
    }
    fetchMessages();
  }, [user, toast]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/messages', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      
      const result = await response.json();
      if (result.success) {
        setMessages(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch messages');
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: "Failed to fetch messages. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    try {
      const response = await fetch(`/api/admin/messages/${messageId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete message');
      }
      
      const result = await response.json();
      if (result.success) {
        setMessages(messages.filter(msg => msg.id !== messageId));
        toast({
          title: "Success",
          description: "Message deleted successfully.",
        });
      } else {
        throw new Error(result.message || 'Failed to delete message');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Error",
        description: "Failed to delete message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const filteredMessages = messages.filter(message => {
    // Hide messages from specific user
    if (message.sender.email === 'malgatitx@gmail.com') {
      return false;
    }
    
    const searchLower = searchTerm.toLowerCase();
    return (
      message.subject.toLowerCase().includes(searchLower) ||
      message.content.toLowerCase().includes(searchLower) ||
      message.sender.username.toLowerCase().includes(searchLower) ||
      message.sender.fullName.toLowerCase().includes(searchLower) ||
      message.sender.email.toLowerCase().includes(searchLower)
    );
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'paid':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const MessageDetailsDialog = ({ message }: { message: AdminMessage }) => (
    <AlertDialog open={showDetails} onOpenChange={setShowDetails}>
      <AlertDialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto w-[95vw] sm:w-full">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base sm:text-lg">Message Details</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2 text-sm sm:text-base">Sender Information</h4>
              <div className="space-y-1 text-xs sm:text-sm">
                <p><span className="font-medium">Username:</span> {message.sender.username}</p>
                <p><span className="font-medium">Full Name:</span> {message.sender.fullName}</p>
                <p className="break-all"><span className="font-medium">Email:</span> {message.sender.email}</p>
                <p><span className="font-medium">Role:</span> 
                  <Badge variant={getRoleBadgeVariant(message.sender.role)} className="ml-2">
                    {message.sender.role}
                  </Badge>
                </p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-sm sm:text-base">Message Information</h4>
              <div className="space-y-1 text-xs sm:text-sm">
                <p className="break-words"><span className="font-medium">Subject:</span> {message.subject}</p>
                <p><span className="font-medium">Type:</span> {message.messageType}</p>
                <p><span className="font-medium">Sent:</span> {format(new Date(message.createdAt), 'PPpp')}</p>
                {message.inReplyTo && (
                  <p><span className="font-medium">Reply to:</span> Message #{message.inReplyTo}</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2 text-sm sm:text-base">Message Content</h4>
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
              <p className="whitespace-pre-wrap text-xs sm:text-sm break-words">{message.content}</p>
            </div>
          </div>

          {message.recipients.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-sm sm:text-base">Recipients ({message.recipients.length})</h4>
              <div className="space-y-2">
                {message.recipients.map((recipient, index) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-gray-50 rounded">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <span className="font-medium text-xs sm:text-sm">{recipient.fullName || recipient.username}</span>
                      <span className="text-xs text-gray-500 break-all">({recipient.email})</span>
                      <Badge variant={getRoleBadgeVariant(recipient.role)} className="w-fit">
                        {recipient.role}
                      </Badge>
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500">
                      {recipient.readAt ? `Read: ${format(new Date(recipient.readAt), 'PPp')}` : 'Unread'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {message.attachments.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-sm sm:text-base">Attachments ({message.attachments.length})</h4>
              <div className="space-y-2">
                {message.attachments.map((attachment, index) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-gray-50 rounded">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-xs sm:text-sm break-words">{attachment.filename}</span>
                      <span className="text-xs text-gray-500 block sm:inline sm:ml-2">({attachment.size})</span>
                    </div>
                    <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                      <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="w-full sm:w-auto">Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="container p-6">
          <div className="text-center">Loading messages...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="container p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Message Management</h1>
          <p className="text-muted-foreground">
            Review and manage all user messages sent through the platform. Monitor for problematic content and take appropriate action.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                All Messages ({filteredMessages.length})
              </CardTitle>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search messages..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-full sm:w-64"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchMessages}
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredMessages.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? 'No messages match your search criteria.' : 'No messages found.'}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead>Sender</TableHead>
                        <TableHead>Recipients</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMessages.map((message) => (
                        <TableRow key={message.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {message.deletedBySender && (
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              )}
                              <div>
                                <p className="font-medium truncate max-w-48">{message.subject}</p>
                                <p className="text-sm text-muted-foreground truncate max-w-48">
                                  {message.content.substring(0, 60)}...
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <div>
                                <p className="font-medium">{message.sender.fullName || message.sender.username}</p>
                                <p className="text-sm text-muted-foreground">{message.sender.email}</p>
                                <Badge variant={getRoleBadgeVariant(message.sender.role)} className="text-xs">
                                  {message.sender.role}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Mail className="h-4 w-4" />
                              <span>{message.recipients.length}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span className="text-sm">
                                {format(new Date(message.createdAt), 'MMM d, yyyy')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{message.messageType}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedMessage(message);
                                  setShowDetails(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Message</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this message? This action cannot be undone.
                                      The message will be permanently removed from the system.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteMessage(message.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete Message
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                  {filteredMessages.map((message) => (
                    <Card key={message.id} className="p-4">
                      <div className="space-y-3">
                        {/* Header with subject and status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            {message.deletedBySender && (
                              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium text-sm line-clamp-2">{message.subject}</h3>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {message.content.substring(0, 100)}...
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {message.messageType}
                          </Badge>
                        </div>

                        {/* Sender info */}
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">
                              {message.sender.fullName || message.sender.username}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {message.sender.email}
                            </p>
                          </div>
                          <Badge variant={getRoleBadgeVariant(message.sender.role)} className="text-xs flex-shrink-0">
                            {message.sender.role}
                          </Badge>
                        </div>

                        {/* Meta info */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <span>{message.recipients.length} recipients</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{format(new Date(message.createdAt), 'MMM d, yyyy')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedMessage(message);
                              setShowDetails(true);
                            }}
                            className="flex-1"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="px-3">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Message</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this message? This action cannot be undone.
                                  The message will be permanently removed from the system.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteMessage(message.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete Message
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {selectedMessage && (
          <MessageDetailsDialog message={selectedMessage} />
        )}
      </div>
    </AdminLayout>
  );
}