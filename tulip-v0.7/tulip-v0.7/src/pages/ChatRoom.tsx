import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, Lock, MessageCircle, Send, Share2, Sparkles, Star, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  type CatalogProduct,
  createPrivateChatWithMember,
  ensureCommunityChatRoom,
  getCatalogProduct,
  listChatMessages,
  listMyChatRooms,
  searchCatalogProducts,
  searchChatMembers,
  sendProductShareMessage,
  sendReviewMessage,
  sendTextMessage,
  subscribeToChatMessages,
  upsertProductReview,
  type ChatMemberCandidate,
  type ChatMessageItem,
  type ChatRoomListItem,
} from '@/lib/chat';

const toSecureImageUrl = (value: string) => value.replace(/^http:\/\//i, 'https://');
const formatPrice = (value: number) => `₹${value.toLocaleString()}`;
const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
const formatShortDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });

const getStringValue = (value: unknown): string => (typeof value === 'string' ? value : '');
const getNumberValue = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};

const ChatRoomPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rooms, setRooms] = useState<ChatRoomListItem[]>([]);
  const [activeRoomId, setActiveRoomId] = useState('');
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSharingProduct, setIsSharingProduct] = useState(false);
  const [isPostingReview, setIsPostingReview] = useState(false);

  const [messageText, setMessageText] = useState('');

  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<ChatMemberCandidate[]>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [invitingMemberId, setInvitingMemberId] = useState('');

  const [shareQuery, setShareQuery] = useState('');
  const [shareProductId, setShareProductId] = useState('');
  const [shareNote, setShareNote] = useState('');

  const [reviewQuery, setReviewQuery] = useState('');
  const [reviewProductId, setReviewProductId] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [shareSuggestions, setShareSuggestions] = useState<CatalogProduct[]>([]);
  const [reviewSuggestions, setReviewSuggestions] = useState<CatalogProduct[]>([]);
  const [selectedShareProduct, setSelectedShareProduct] = useState<CatalogProduct | null>(null);
  const [selectedReviewProduct, setSelectedReviewProduct] = useState<CatalogProduct | null>(null);
  const roomRefreshDebounceRef = React.useRef<number | null>(null);

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId) || null,
    [activeRoomId, rooms],
  );

  const refreshMessages = useCallback(
    async (targetRoomId?: string) => {
      const effectiveRoomId = targetRoomId || activeRoomId;
      if (!effectiveRoomId) {
        setMessages([]);
        return;
      }

      const latest = await listChatMessages(effectiveRoomId, 180);
      setMessages(latest);
    },
    [activeRoomId],
  );

  const refreshRooms = useCallback(
    async (preferredRoomId?: string, requestedRoomIdParam = '') => {
      const nextRooms = await listMyChatRooms();
      setRooms(nextRooms);

      const requestedRoomId = preferredRoomId || requestedRoomIdParam;
      const roomExists = (roomId: string) => nextRooms.some((room) => room.id === roomId);

      if (requestedRoomId && roomExists(requestedRoomId)) {
        setActiveRoomId(requestedRoomId);
        return nextRooms;
      }

      setActiveRoomId((current) => {
        if (current && roomExists(current)) {
          return current;
        }

        const communityRoom = nextRooms.find((room) => room.slug === 'community');
        return communityRoom?.id || nextRooms[0]?.id || '';
      });

      return nextRooms;
    },
    [],
  );

  useEffect(() => {
    const sharedProductId = searchParams.get('shareProduct')?.trim() || '';
    if (!sharedProductId) {
      return;
    }

    let isCancelled = false;

    void getCatalogProduct(sharedProductId).then((sharedProduct) => {
      if (!sharedProduct || isCancelled) {
        return;
      }

      setShareProductId(sharedProduct.id);
      setShareQuery(sharedProduct.name);
      setSelectedShareProduct(sharedProduct);
      setReviewProductId((prev) => prev || sharedProduct.id);
      setReviewQuery((prev) => prev || sharedProduct.name);
      setSelectedReviewProduct((prev) => prev || sharedProduct);
    });

    return () => {
      isCancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let isCancelled = false;

    const initialize = async () => {
      setIsLoading(true);
      try {
        await ensureCommunityChatRoom();
        const requestedRoomId = searchParams.get('room') || '';
        const nextRooms = await refreshRooms(undefined, requestedRoomId);
        if (isCancelled) {
          return;
        }

        if (nextRooms.length === 0) {
          setActiveRoomId('');
          setMessages([]);
        }
      } catch (error) {
        if (isCancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Unable to open chat rooms.';
        toast({ title: message, variant: 'destructive' });
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      isCancelled = true;
    };
  }, [refreshRooms, toast, user?.id]);

  useEffect(() => {
    if (!activeRoomId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    if (nextParams.get('room') !== activeRoomId) {
      nextParams.set('room', activeRoomId);
      setSearchParams(nextParams, { replace: true });
    }

    void refreshMessages(activeRoomId);
  }, [activeRoomId, refreshMessages, searchParams, setSearchParams]);

  useEffect(() => {
    if (!activeRoomId) {
      return;
    }

    return subscribeToChatMessages(activeRoomId, async () => {
      await refreshMessages(activeRoomId);

      if (roomRefreshDebounceRef.current) {
        window.clearTimeout(roomRefreshDebounceRef.current);
      }

      roomRefreshDebounceRef.current = window.setTimeout(() => {
        void refreshRooms(activeRoomId);
        roomRefreshDebounceRef.current = null;
      }, 400);
    });
  }, [activeRoomId, refreshMessages, refreshRooms]);

  useEffect(() => () => {
    if (roomRefreshDebounceRef.current) {
      window.clearTimeout(roomRefreshDebounceRef.current);
      roomRefreshDebounceRef.current = null;
    }
  }, []);

  useEffect(() => {
    const query = inviteQuery.trim();
    let isCancelled = false;
    setIsSearchingMembers(true);

    const timerId = window.setTimeout(() => {
      void searchChatMembers(query, 8)
        .then((members) => {
          if (!isCancelled) {
            setInviteResults(members);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setInviteResults([]);
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setIsSearchingMembers(false);
          }
        });
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timerId);
    };
  }, [inviteQuery]);

  useEffect(() => {
    let isCancelled = false;

    const timerId = window.setTimeout(() => {
      void searchCatalogProducts(shareQuery, 8)
        .then((nextSuggestions) => {
          if (!isCancelled) {
            setShareSuggestions(nextSuggestions);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setShareSuggestions([]);
          }
        });
    }, 200);

    return () => {
      isCancelled = true;
      window.clearTimeout(timerId);
    };
  }, [shareQuery]);

  useEffect(() => {
    let isCancelled = false;

    const timerId = window.setTimeout(() => {
      void searchCatalogProducts(reviewQuery, 8)
        .then((nextSuggestions) => {
          if (!isCancelled) {
            setReviewSuggestions(nextSuggestions);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setReviewSuggestions([]);
          }
        });
    }, 200);

    return () => {
      isCancelled = true;
      window.clearTimeout(timerId);
    };
  }, [reviewQuery]);

  useEffect(() => {
    if (!shareProductId) {
      setSelectedShareProduct(null);
      return;
    }

    let isCancelled = false;
    void getCatalogProduct(shareProductId)
      .then((product) => {
        if (!isCancelled) {
          setSelectedShareProduct(product);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setSelectedShareProduct(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [shareProductId]);

  useEffect(() => {
    if (!reviewProductId) {
      setSelectedReviewProduct(null);
      return;
    }

    let isCancelled = false;
    void getCatalogProduct(reviewProductId)
      .then((product) => {
        if (!isCancelled) {
          setSelectedReviewProduct(product);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setSelectedReviewProduct(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [reviewProductId]);

  const clearShareProductParam = () => {
    if (!searchParams.get('shareProduct')) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('shareProduct');
    setSearchParams(nextParams, { replace: true });
  };

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeRoomId || !user?.id || !messageText.trim()) {
      return;
    }

    setIsSendingMessage(true);
    try {
      await sendTextMessage(activeRoomId, user.id, messageText);
      setMessageText('');
      await refreshMessages(activeRoomId);
      await refreshRooms(activeRoomId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send message.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleInviteMember = async (member: ChatMemberCandidate) => {
    if (!user?.id) {
      return;
    }

    setInvitingMemberId(member.userId);
    try {
      const privateRoomId = await createPrivateChatWithMember(member.userId);
      await refreshRooms(privateRoomId);
      setActiveRoomId(privateRoomId);
      setInviteQuery('');
      setInviteResults([]);
      toast({ title: `Private chat started with ${member.displayName}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start private chat.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setInvitingMemberId('');
    }
  };

  const handleShareProduct = async () => {
    if (!activeRoomId || !user?.id || !shareProductId) {
      toast({ title: 'Please select a product first.', variant: 'destructive' });
      return;
    }

    setIsSharingProduct(true);
    try {
      await sendProductShareMessage(activeRoomId, user.id, {
        productId: shareProductId,
        note: shareNote,
      });
      setShareNote('');
      clearShareProductParam();
      await refreshMessages(activeRoomId);
      await refreshRooms(activeRoomId);
      toast({ title: 'Product shared to chat.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to share product right now.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsSharingProduct(false);
    }
  };

  const handlePostReview = async () => {
    if (!activeRoomId || !user?.id || !reviewProductId) {
      toast({ title: 'Please select a product before reviewing.', variant: 'destructive' });
      return;
    }

    if (!reviewText.trim()) {
      toast({ title: 'Review text cannot be empty.', variant: 'destructive' });
      return;
    }

    setIsPostingReview(true);
    try {
      const savedReview = await upsertProductReview({
        productId: reviewProductId,
        userId: user.id,
        rating: reviewRating,
        reviewText,
        roomId: activeRoomId,
      });

      await sendReviewMessage(activeRoomId, user.id, {
        productId: reviewProductId,
        rating: reviewRating,
        reviewText,
        reviewId: savedReview.id,
      });

      setReviewText('');
      await refreshMessages(activeRoomId);
      await refreshRooms(activeRoomId);
      toast({ title: 'Review posted to chat.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to post review right now.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsPostingReview(false);
    }
  };

  const panelCardClass =
    'rounded-2xl border border-border/60 bg-card/85 p-4 shadow-soft backdrop-blur-sm space-y-3';
  const panelHeaderClass = 'flex items-center gap-2 text-sm font-semibold';
  const statCardClass = 'rounded-2xl border border-border/60 bg-card/80 p-4 shadow-soft backdrop-blur-sm';
  const inviteEmptyMessage = inviteQuery.trim().length === 0 ? 'No members available right now.' : 'No members found.';
  const privateRoomsCount = useMemo(() => rooms.filter((room) => room.isPrivate).length, [rooms]);
  const communityRoomsCount = useMemo(() => rooms.filter((room) => !room.isPrivate).length, [rooms]);

  const renderMessageContent = (item: ChatMessageItem) => {
    if (item.messageType === 'product_share') {
      const productId = getStringValue(item.metadata.product_id) || getStringValue(item.metadata.productId);
      const productName =
        getStringValue(item.metadata.product_name) || getStringValue(item.metadata.productName) || 'Shared product';
      const brand = getStringValue(item.metadata.brand);
      const imageUrl = getStringValue(item.metadata.image_url) || getStringValue(item.metadata.imageUrl);
      const price = getNumberValue(item.metadata.price);

      return (
        <div className="space-y-2">
          <p className="text-sm">{item.content}</p>
          <div className="rounded-xl border border-border bg-background p-3 flex gap-3">
            {imageUrl ? (
              <img
                src={toSecureImageUrl(imageUrl)}
                alt={productName}
                className="w-14 h-14 rounded-lg object-cover bg-secondary"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-secondary" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground truncate">{brand || 'Product'}</p>
              <p className="text-sm font-semibold truncate">{productName}</p>
              {price > 0 && <p className="text-xs text-muted-foreground mt-0.5">{formatPrice(price)}</p>}
              {productId && (
                <Link className="text-xs text-primary hover:underline mt-1 inline-flex" to={`/product/${productId}`}>
                  View product
                </Link>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (item.messageType === 'review') {
      const productId = getStringValue(item.metadata.product_id) || getStringValue(item.metadata.productId);
      const productName = getStringValue(item.metadata.product_name) || getStringValue(item.metadata.productName) || 'Product';
      const rating = Math.min(5, Math.max(1, Math.round(getNumberValue(item.metadata.rating) || 0)));

      return (
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-amber-500">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                size={12}
                className={index < rating ? 'fill-current' : ''}
              />
            ))}
            <span className="text-xs text-muted-foreground ml-1">{rating}/5</span>
          </div>
          {item.content && <p className="text-sm">{item.content}</p>}
          {productId ? (
            <Link className="text-xs text-primary hover:underline" to={`/product/${productId}`}>
              Review for {productName}
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground">Review for {productName}</p>
          )}
        </div>
      );
    }

    return <p className="text-sm whitespace-pre-wrap break-words">{item.content}</p>;
  };

  return (
    <main className="min-h-screen bg-gradient-hero pt-24 pb-12">
      <div className="container mx-auto px-4 sm:px-6">
        <section className="relative mb-6 overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-soft">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/5" />
          <div className="relative px-5 py-6 sm:px-7 sm:py-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
              <Sparkles size={12} /> Chat Dashboard
            </div>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <h1 className="text-3xl font-display font-semibold sm:text-4xl">Tulip Chat Room</h1>
              <p className="text-xs text-muted-foreground">
                {rooms.length} rooms · {messages.length} messages
              </p>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Community conversations, private chats, product shares, and reviews in one dashboard.
            </p>
          </div>
        </section>

        {isLoading ? (
          <div className="rounded-2xl border border-border/60 bg-card/80 p-10 text-muted-foreground shadow-soft flex items-center justify-center gap-3">
            <Loader2 size={16} className="animate-spin" /> Loading chat rooms...
          </div>
        ) : (
          <>
            <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className={statCardClass}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Rooms</p>
                <p className="mt-1.5 text-2xl font-semibold leading-none">{rooms.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">{communityRoomsCount} community, {privateRoomsCount} private</p>
              </div>
              <div className={statCardClass}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Active Room</p>
                <p className="mt-1.5 truncate text-base font-semibold">{activeRoom?.displayName || 'Not selected'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{activeRoom?.isPrivate ? 'Private room' : 'Community room'}</p>
              </div>
              <div className={statCardClass}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Current Messages</p>
                <p className="mt-1.5 text-2xl font-semibold leading-none">{messages.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Messages in active room</p>
              </div>
              <div className={statCardClass}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Quick Invite</p>
                <p className="mt-1.5 text-2xl font-semibold leading-none">{inviteResults.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Member suggestions</p>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
              <aside className="self-start space-y-4 xl:sticky xl:top-24">
                <div className={panelCardClass}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Conversations</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-lg px-2 text-xs"
                      onClick={() => void refreshRooms(activeRoomId)}
                    >
                      Refresh
                    </Button>
                  </div>
                  <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                    {rooms.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No chat rooms yet.</p>
                    ) : (
                      rooms.map((room) => {
                        const active = room.id === activeRoomId;
                        return (
                          <button
                            key={room.id}
                            onClick={() => setActiveRoomId(room.id)}
                            className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                              active
                                ? 'border-primary/40 bg-primary/10 shadow-soft'
                                : 'border-border/70 bg-background/90 hover:bg-secondary/60'
                            }`}
                          >
                            <div className="mb-0.5 flex items-center gap-1.5">
                              {room.isPrivate ? (
                                <Lock size={12} className="text-primary" />
                              ) : (
                                <MessageCircle size={12} className="text-primary" />
                              )}
                              <p className="truncate text-sm font-medium">{room.displayName}</p>
                            </div>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {room.lastMessageAt ? `Last activity ${formatShortDate(room.lastMessageAt)}` : 'No messages yet'}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className={panelCardClass}>
                  <div className={panelHeaderClass}>
                    <UserPlus size={14} className="text-primary" />
                    <p>Invite Member</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Start a private 1:1 chat with someone from the community.</p>
                  <Input
                    value={inviteQuery}
                    onChange={(event) => setInviteQuery(event.target.value)}
                    placeholder="Search member by name or email"
                  />
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-border/70 bg-background/80">
                    {isSearchingMembers ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
                        <Loader2 size={12} className="animate-spin" /> Searching members...
                      </div>
                    ) : inviteResults.length === 0 ? (
                      <div className="px-3 py-2.5 text-xs text-muted-foreground">{inviteEmptyMessage}</div>
                    ) : (
                      inviteResults.map((member) => (
                        <div key={member.userId} className="border-b border-border/70 bg-background px-3 py-2.5 last:border-b-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{member.displayName}</p>
                              <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                            </div>
                            <Button
                              size="sm"
                              className="h-7 rounded-lg px-2.5 text-xs"
                              disabled={invitingMemberId === member.userId}
                              onClick={() => void handleInviteMember(member)}
                            >
                              {invitingMemberId === member.userId ? <Loader2 size={12} className="animate-spin" /> : 'Invite'}
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </aside>

              <section className="self-start flex h-[70vh] min-h-[520px] flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/85 shadow-soft xl:h-[calc(100vh-9rem)]">
                <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-secondary/30 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {activeRoom?.isPrivate ? <Lock size={14} /> : <MessageCircle size={14} />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{activeRoom?.displayName || 'Chat Room'}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {activeRoom?.isPrivate ? 'Private room' : 'Community room'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                      {messages.length} msgs
                    </span>
                    <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                      Live
                    </span>
                  </div>
                </div>

                <ScrollArea className="flex-1 bg-secondary/15">
                  <div className="space-y-4 p-4 sm:p-5">
                    {messages.length === 0 ? (
                      <div className="py-20 text-center text-sm text-muted-foreground">
                        No messages yet. Start the conversation.
                      </div>
                    ) : (
                      messages.map((item) => {
                        const isOwnMessage = item.userId === user?.id;

                        return (
                          <div
                            key={item.id}
                            className={`max-w-[88%] rounded-2xl border px-4 py-3 ${
                              isOwnMessage
                                ? 'ml-auto border-primary/30 bg-primary/10 shadow-soft'
                                : 'border-border/80 bg-background/95'
                            }`}
                          >
                            <div className={`mb-1.5 flex items-center gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                              <span className={`text-[11px] font-semibold ${isOwnMessage ? 'text-primary' : 'text-muted-foreground'}`}>
                                {isOwnMessage ? 'You' : item.userName}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{formatTime(item.createdAt)}</span>
                            </div>
                            {renderMessageContent(item)}
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>

                <form onSubmit={handleSendMessage} className="mt-auto border-t border-border/70 bg-card/90 p-3 backdrop-blur-sm sm:p-4">
                  <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/95 p-2 shadow-soft">
                    <div className="pl-1 text-muted-foreground">
                      <MessageCircle size={14} />
                    </div>
                    <Input
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                      placeholder="Type your text..."
                      className="h-10 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSendingMessage || !messageText.trim() || !activeRoomId}
                      className="h-10 gap-1.5 rounded-xl px-3.5"
                    >
                      {isSendingMessage ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      Send
                    </Button>
                  </div>
                </form>
              </section>

              <aside className="self-start space-y-4 xl:sticky xl:top-24">
                <div className={panelCardClass}>
                  <div className={panelHeaderClass}>
                    <Share2 size={14} className="text-primary" />
                    <p>Share Product</p>
                  </div>

                  <Input
                    value={shareQuery}
                    onChange={(event) => setShareQuery(event.target.value)}
                    placeholder="Search by product name, brand or ID"
                  />

                  <div className="max-h-44 overflow-y-auto rounded-xl border border-border/70 bg-background/80">
                    {shareSuggestions.length === 0 ? (
                      <p className="px-3 py-2.5 text-xs text-muted-foreground">No products found.</p>
                    ) : (
                      shareSuggestions.map((product) => {
                        const isSelected = shareProductId === product.id;
                        return (
                          <button
                            key={product.id}
                            onClick={() => {
                              setShareProductId(product.id);
                              setShareQuery(product.name);
                              setSelectedShareProduct(product);
                            }}
                            className={`w-full border-b border-border/70 px-3 py-2 text-left transition-colors last:border-b-0 ${
                              isSelected ? 'bg-secondary/90' : 'bg-background hover:bg-secondary/60'
                            }`}
                          >
                            <p className="truncate text-sm font-medium">{product.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{product.brand} • #{product.id}</p>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {selectedShareProduct && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-secondary/30 p-2.5">
                      <img
                        src={toSecureImageUrl(selectedShareProduct.image)}
                        alt={selectedShareProduct.name}
                        className="h-11 w-11 rounded-lg object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{selectedShareProduct.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{formatPrice(selectedShareProduct.price)}</p>
                      </div>
                    </div>
                  )}

                  <Textarea
                    value={shareNote}
                    onChange={(event) => setShareNote(event.target.value)}
                    placeholder="Optional note (for example: Which color looks better?)"
                    rows={3}
                    className="resize-none"
                  />

                  <Button
                    className="w-full"
                    onClick={handleShareProduct}
                    disabled={isSharingProduct || !shareProductId || !activeRoomId}
                  >
                    {isSharingProduct ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
                    Share to Current Room
                  </Button>
                </div>

                <div className={panelCardClass}>
                  <div className={panelHeaderClass}>
                    <Star size={14} className="text-primary" />
                    <p>Post Review</p>
                  </div>

                  <Input
                    value={reviewQuery}
                    onChange={(event) => setReviewQuery(event.target.value)}
                    placeholder="Select product to review"
                  />

                  <div className="max-h-44 overflow-y-auto rounded-xl border border-border/70 bg-background/80">
                    {reviewSuggestions.length === 0 ? (
                      <p className="px-3 py-2.5 text-xs text-muted-foreground">No products found.</p>
                    ) : (
                      reviewSuggestions.map((product) => {
                        const isSelected = reviewProductId === product.id;
                        return (
                          <button
                            key={product.id}
                            onClick={() => {
                              setReviewProductId(product.id);
                              setReviewQuery(product.name);
                              setSelectedReviewProduct(product);
                            }}
                            className={`w-full border-b border-border/70 px-3 py-2 text-left transition-colors last:border-b-0 ${
                              isSelected ? 'bg-secondary/90' : 'bg-background hover:bg-secondary/60'
                            }`}
                          >
                            <p className="truncate text-sm font-medium">{product.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{product.brand} • #{product.id}</p>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: 5 }).map((_, index) => {
                      const value = index + 1;
                      return (
                        <button
                          key={value}
                          onClick={() => setReviewRating(value)}
                          className="rounded-md p-1 hover:bg-secondary"
                          aria-label={`Set rating ${value}`}
                        >
                          <Star
                            size={18}
                            className={value <= reviewRating ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground'}
                          />
                        </button>
                      );
                    })}
                    <span className="ml-1 text-xs text-muted-foreground">{reviewRating}/5</span>
                  </div>

                  {selectedReviewProduct && (
                    <p className="text-xs text-muted-foreground">
                      Reviewing <span className="font-medium text-foreground">{selectedReviewProduct.name}</span>
                    </p>
                  )}

                  <Textarea
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                    placeholder="Write your review..."
                    rows={4}
                    className="resize-none"
                  />

                  <Button
                    className="w-full"
                    onClick={handlePostReview}
                    disabled={isPostingReview || !reviewProductId || !reviewText.trim() || !activeRoomId}
                  >
                    {isPostingReview ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
                    Post Review to Current Room
                  </Button>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default ChatRoomPage;