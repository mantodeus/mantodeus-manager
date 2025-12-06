import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

type ViewMode = 'daily' | 'weekly' | 'monthly';

interface CalendarEvent {
  id: number;
  title: string;
  date: Date | null;
  type: 'job' | 'task';
  status: string;
  description?: string;
}

export default function Calendar() {
  const [, setLocation] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [highlightJobId, setHighlightJobId] = useState<number | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const focusDateParam = url.searchParams.get('focusDate');
    const highlightParam = url.searchParams.get('highlightJobId');

    if (focusDateParam) {
      const parsedDate = new Date(focusDateParam);
      if (!Number.isNaN(parsedDate.getTime())) {
        setCurrentDate(parsedDate);
        setSelectedDate(parsedDate);
        setViewMode('monthly');
      }
    }

    if (highlightParam) {
      const parsedHighlight = parseInt(highlightParam, 10);
      if (!Number.isNaN(parsedHighlight)) {
        setHighlightJobId(parsedHighlight);
      }
    }

    if (focusDateParam || highlightParam) {
      url.searchParams.delete('focusDate');
      url.searchParams.delete('highlightJobId');
      const nextSearch = url.searchParams.toString();
      const nextHref = nextSearch ? `${url.pathname}?${nextSearch}${url.hash}` : `${url.pathname}${url.hash}`;
      window.history.replaceState(null, '', nextHref);
    }
  }, [location]);

  const handleProjectClick = (projectId: number) => {
    setLocation(`/projects/${projectId}`);
  };

  const handleJobClick = (jobId: number) => {
    setLocation(`/jobs/${jobId}`);
  };

  const dateRange = useMemo(() => {
    const date = new Date(currentDate);
    
    if (viewMode === 'daily') {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    
    if (viewMode === 'weekly') {
      const start = new Date(date);
      start.setDate(date.getDate() - date.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [currentDate, viewMode]);

  const { data: events = [], isLoading } = trpc.calendar.getEvents.useQuery({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      if (!event.date) return false;
      const eventDate = new Date(event.date as unknown as string | number | Date);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handlePrevDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDate.getDay());

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();
  const isSelected = (date: Date) => selectedDate?.toDateString() === date.toDateString();

  const renderMonthlyView = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="bg-muted/20 p-1"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayEvents = getEventsForDate(date);
      const today = isToday(date);
      const selected = isSelected(date);

      days.push(
        <div
          key={day}
          onClick={() => setSelectedDate(date)}
          className={`min-h-16 p-1.5 border rounded cursor-pointer transition-all text-xs ${
            today
              ? 'border-accent/40 bg-accent/5'
              : selected
              ? 'border-accent bg-accent/10'
              : 'border-border hover:border-accent/50 hover:bg-muted/30'
          }`}
        >
          <div className={`font-medium mb-0.5 ${today ? 'text-accent/80' : ''}`}>{day}</div>
          <div className="space-y-0.5 overflow-hidden">
            {dayEvents.slice(0, 1).map(event => (
              <div
                key={event.id}
                className={`px-1.5 py-0.5 rounded text-xs truncate font-light ${
                  highlightJobId && event.type === 'job' && event.id === highlightJobId
                    ? 'ring-2 ring-primary/70 ring-offset-1 ring-offset-background'
                    : ''
                }`}
                style={{
                  backgroundColor: event.type === 'job' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                  color: event.type === 'job' ? '#10b981' : '#e9d5ff'
                }}
              >
                {event.title}
              </div>
            ))}
            {dayEvents.length > 1 && (
              <div className="text-xs text-muted-foreground px-1">+{dayEvents.length - 1}</div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="font-medium text-center text-muted-foreground text-xs py-1">
            {day}
          </div>
        ))}
        {days}
      </div>
    );
  };

  const renderWeeklyView = () => {
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dayEvents = getEventsForDate(date);
      const today = isToday(date);
      const selected = isSelected(date);

      weekDays.push(
        <div
          key={i}
          onClick={() => setSelectedDate(date)}
          className={`border rounded p-2 min-h-40 cursor-pointer transition-all ${
            today
              ? 'border-accent/40 bg-accent/5'
              : selected
              ? 'border-accent bg-accent/10'
              : 'border-border hover:border-accent/50 hover:bg-muted/30'
          }`}
        >
          <div className={`font-medium text-xs mb-2 ${today ? 'text-accent/80' : ''}`}>
            {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          <div className="space-y-1">
            {dayEvents.map(event => (
              <div
                key={event.id}
                className={`p-1.5 rounded text-xs font-light ${
                  highlightJobId && event.type === 'job' && event.id === highlightJobId
                    ? 'ring-2 ring-primary/70 ring-offset-1 ring-offset-background'
                    : ''
                }`}
                style={{ backgroundColor: event.type === 'job' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                  color: event.type === 'job' ? '#10b981' : '#e9d5ff'
                }}
              >
                <div className="truncate">{event.title}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return <div className="grid grid-cols-7 gap-1">{weekDays}</div>;
  };

  const renderDailyView = () => {
    const dayEvents = getEventsForDate(currentDate);
    const today = isToday(currentDate);

    return (
      <div className="space-y-3">
        <div className={`p-3 rounded-lg border ${today ? 'bg-accent/5 border-accent/40' : 'bg-muted/5 border-border'}`}>
          <h3 className={`text-base font-medium ${today ? 'text-accent/80' : ''}`}>
            {currentDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </h3>
        </div>

        {dayEvents.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">No events scheduled</div>
        ) : (
          <div className="space-y-2">
            {dayEvents.map(event => (
              <Card 
                key={event.id} 
                className={`text-sm ${
                  highlightJobId && event.type === 'job' && event.id === highlightJobId
                    ? 'ring-2 ring-primary/70'
                    : ''
                }`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-medium">{event.title}</h4>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                      )}
                      <div className="flex gap-1.5 mt-2">
                        <Badge variant={event.type === 'job' ? 'default' : 'secondary'} className="text-xs">
                          {event.type}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{event.status}</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-muted-foreground text-sm">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Calendar</h1>
          <p className="text-muted-foreground text-sm">View jobs and tasks by date</p>
        </div>
      </div>

      {/* View Mode Selector */}
      <div className="flex gap-2">
        {(['daily', 'weekly', 'monthly'] as ViewMode[]).map(mode => (
          <Button
            key={mode}
            variant={viewMode === mode ? 'default' : 'outline'}
            onClick={() => setViewMode(mode)}
            className="capitalize text-sm"
            size="sm"
          >
            {mode}
          </Button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {viewMode === 'daily' && (
            <>
              <Button variant="outline" size="sm" onClick={handlePrevDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleNextDay}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {viewMode === 'weekly' && (
            <>
              <Button variant="outline" size="sm" onClick={handlePrevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {viewMode === 'monthly' && (
            <>
              <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        <div className="text-sm font-medium">{monthName}</div>
        <div className="w-16"></div>
      </div>

      {/* Calendar View */}
      <Card>
        <CardContent className="p-4">
          {viewMode === 'monthly' && renderMonthlyView()}
          {viewMode === 'weekly' && renderWeeklyView()}
          {viewMode === 'daily' && renderDailyView()}
        </CardContent>
      </Card>

      {/* Selected Date Details */}
      {selectedDate && viewMode === 'monthly' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </CardTitle>
              <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-base">Add Task</DialogTitle>
                  </DialogHeader>
                  <div className="text-sm text-muted-foreground">
                    Task creation coming soon. Click on a job to add tasks.
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            {getEventsForDate(selectedDate).length === 0 ? (
              <p className="text-muted-foreground">No events scheduled</p>
            ) : (
              <div className="space-y-2">
                {getEventsForDate(selectedDate).map(event => (
                  <div 
                    key={event.id} 
                className={`p-2.5 border rounded-lg text-xs ${
                  event.type === 'job' ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''
                } ${
                  highlightJobId && event.type === 'job' && event.id === highlightJobId ? 'ring-2 ring-primary/70' : ''
                }`}
                    onClick={() => event.type === 'job' && handleJobClick(event.id)}
                  >
                    <h4 className="font-medium">{event.title}</h4>
                    {event.description && (
                      <p className="text-muted-foreground mt-1">{event.description}</p>
                    )}
                    <div className="flex gap-1.5 mt-2">
                      <Badge variant={event.type === 'job' ? 'default' : 'secondary'} className="text-xs">
                        {event.type}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{event.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
