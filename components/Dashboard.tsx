
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bell, Search, Home, MessageSquare, Search as SearchIcon, 
  HelpCircle, Calendar, Plus, Heart, MessageCircle, MoreVertical, 
  AlertTriangle, Flag, CheckCircle, User, LogOut, Trash2, BookOpen, Clock, MapPin,
  Menu, X, Send, ClipboardCheck, Check, Info, TrendingUp, AlertCircle, ArrowRight, PieChart
} from 'lucide-react';
import { Session, Post, PostType, AttendanceData, Alert, AttendanceRecord, Lecture, Comment, SubjectAttendance, AttendanceEntry } from '../types';
import { 
  getAnnouncements, getDiscussions, getLostFound, getAttendance, getAlerts, getLectures, getStudentAttendance,
  saveAnnouncements, saveDiscussions, saveLostFound, saveAttendance, saveAlerts, saveLectures, saveStudentAttendance, setSession,
  deleteAnnouncement
} from '../services/storage';
import CreatePostModal from './CreatePostModal';
import TutorChat from './TutorChat';

interface Props {
  session: Session;
  onLogout: () => void;
}

const Dashboard: React.FC<Props> = ({ session, onLogout }) => {
  // --- State ---
  // Default tab depends on role
  const [activeTab, setActiveTab] = useState(session.role === 'teacher' ? 'announcements' : 'home');
  const [filter, setFilter] = useState<'all' | PostType>('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Data State
  const [announcements, setAnnouncements] = useState<Post[]>([]);
  const [discussions, setDiscussions] = useState<Record<string, Post[]>>({});
  const [lostFound, setLostFound] = useState<Post[]>([]);
  const [attendance, setAttendance] = useState<AttendanceData>({}); // Teacher data
  const [myAttendance, setMyAttendance] = useState<SubjectAttendance[]>([]); // Student self-tracking
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);

  // Commenting State
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  // Lecture Form State (for teachers)
  const [newLecture, setNewLecture] = useState({ subject: '', topic: '', time: '', room: '' });

  // Subject Form State (for student attendance)
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  
  // Mark Attendance Modal State
  const [showMarkAttendanceModal, setShowMarkAttendanceModal] = useState(false);
  const [selectedSubjectForMark, setSelectedSubjectForMark] = useState<string>('');
  const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'late' | 'absent'>('present');

  // Force Refresh
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  // --- Effects ---
  useEffect(() => {
    setAnnouncements(getAnnouncements());
    setDiscussions(getDiscussions());
    setLostFound(getLostFound());
    setAttendance(getAttendance());
    setAlerts(getAlerts());
    setLectures(getLectures());
    if (session.role === 'student') {
      setMyAttendance(getStudentAttendance(session.email));
    }
  }, [tick, session.email, session.role]);

  // --- Helpers ---
  const isTeacher = session.role === 'teacher';
  const isPrivileged = session.role === 'teacher' || session.role === 'president';

  const handlePostSubmit = (data: { type: PostType; title: string; desc: string; anon: boolean }) => {
    const newPost: Post = {
      id: `${data.type}_${Date.now()}`,
      type: data.type,
      title: data.title,
      desc: data.desc,
      author: session.email,
      time: new Date().toLocaleString(),
      anon: data.anon,
      likes: 0,
      comments: [],
      highAlert: false,
      reported: false
    };

    if (data.type === 'announcement') {
      const updated = [...announcements, newPost];
      saveAnnouncements(updated);
    } else if (data.type === 'discussion') {
      const updated = { ...discussions };
      if (!updated['general']) updated['general'] = [];
      updated['general'].push({ ...newPost, category: 'General' });
      saveDiscussions(updated);
    } else if (data.type === 'lostfound') {
      const updated = [...lostFound, newPost];
      saveLostFound(updated);
    } 
    
    setShowModal(false);
    refresh();
  };

  const handleDeletePost = (post: Post) => {
    if (post.type === 'announcement' && isPrivileged) {
      if (confirm('Are you sure you want to delete this announcement?')) {
        deleteAnnouncement(post.id);
        refresh();
      }
    }
  };

  const toggleHighAlert = (post: Post) => {
    if (!isPrivileged || post.type !== 'lostfound') return;
    
    const updatedPosts = lostFound.map(p => {
      if (p.id === post.id) return { ...p, highAlert: !p.highAlert };
      return p;
    });
    saveLostFound(updatedPosts);
    setLostFound(updatedPosts);

    if (!post.highAlert) {
      const newAlert: Alert = { id: `alert_${Date.now()}`, text: `High Alert: ${post.title}`, time: new Date().toLocaleString() };
      saveAlerts([...alerts, newAlert]);
    } else {
      const newAlerts = alerts.filter(a => !a.text.includes(post.title || ''));
      saveAlerts(newAlerts);
    }
    refresh();
  };

  const handleLike = (post: Post) => {
    if (post.type === 'announcement') {
      const updated = announcements.map(p => {
        if (p.id === post.id) return { ...p, likes: p.likes + 1 };
        return p;
      });
      saveAnnouncements(updated);
      setAnnouncements(updated);
    }
  };

  const handleAddComment = (post: Post) => {
    if (!commentText.trim()) return;

    const newComment: Comment = {
        id: `c_${Date.now()}`,
        author: session.email,
        text: commentText,
        time: new Date().toLocaleString()
    };

    const updatePostList = (list: Post[]) => list.map(p => {
        if (p.id === post.id) {
            return { ...p, comments: [...p.comments, newComment] };
        }
        return p;
    });

    if (post.type === 'announcement') {
        const updated = updatePostList(announcements);
        saveAnnouncements(updated);
        setAnnouncements(updated);
    } else if (post.type === 'discussion') {
        let categoryKey = 'general';
        Object.entries(discussions).forEach(([key, posts]) => {
            if (posts.find(p => p.id === post.id)) categoryKey = key;
        });
        
        const updatedDiscussions = { ...discussions };
        updatedDiscussions[categoryKey] = updatePostList(updatedDiscussions[categoryKey] || []);
        saveDiscussions(updatedDiscussions);
        setDiscussions(updatedDiscussions);
    } else if (post.type === 'lostfound') {
        const updated = updatePostList(lostFound);
        saveLostFound(updated);
        setLostFound(updated);
    }

    setCommentText('');
  };

  const handleAddLecture = () => {
    if (!newLecture.subject || !newLecture.time) return;
    const lec: Lecture = {
      id: `lec_${Date.now()}`,
      subject: newLecture.subject,
      topic: newLecture.topic,
      time: newLecture.time,
      room: newLecture.room,
      teacherName: isTeacher ? 'You' : session.email 
    };
    const updated = [...lectures, lec];
    saveLectures(updated);
    setLectures(updated);
    setNewLecture({ subject: '', topic: '', time: '', room: '' });
  };

  // --- Self Attendance Handlers ---
  const handleAddSubject = () => {
    if (!newSubjectName.trim()) return;
    const newSubject: SubjectAttendance = {
      id: `sub_${Date.now()}`,
      name: newSubjectName,
      entries: []
    };
    const updated = [...myAttendance, newSubject];
    saveStudentAttendance(session.email, updated);
    setMyAttendance(updated);
    setNewSubjectName('');
    setIsAddingSubject(false);
  };

  const handleDeleteSubject = (id: string) => {
    if (confirm('Delete this subject and all its attendance history?')) {
      const updated = myAttendance.filter(s => s.id !== id);
      saveStudentAttendance(session.email, updated);
      setMyAttendance(updated);
    }
  };

  const handleManualAttendanceSubmit = () => {
    if (!selectedSubjectForMark) {
        alert('Please select a subject');
        return;
    }

    const updated = myAttendance.map(sub => {
      if (sub.id === selectedSubjectForMark) {
        return {
          ...sub,
          entries: [...sub.entries, { id: `entry_${Date.now()}`, timestamp: Date.now(), status: attendanceStatus }]
        };
      }
      return sub;
    });
    saveStudentAttendance(session.email, updated);
    setMyAttendance(updated);
    setShowMarkAttendanceModal(false);
    // Reset defaults
    setAttendanceStatus('present');
    setSelectedSubjectForMark('');
  };

  // --- Navigation Items ---
  const SIDEBAR_ITEMS = isTeacher 
    ? [
        { id: 'announcements', label: 'Announcements', icon: Bell, desc: 'Manage Posts' },
        { id: 'chat', label: 'Teacher Chat', icon: MessageCircle, desc: 'Solve Doubts' },
        { id: 'lectures', label: 'Lectures', icon: BookOpen, desc: 'Manage Sessions' },
      ]
    : [
        { id: 'home', label: 'Home', icon: Home, desc: 'Unified feed' },
        { id: 'announcements', label: 'Announcements', icon: Bell, desc: 'Campus News' },
        { id: 'discussion', label: 'Discussion', icon: MessageSquare, desc: 'Students only' },
        { id: 'tutor', label: 'Private Tutor', icon: HelpCircle, desc: 'Ask Doubts' },
        { id: 'attendance', label: 'Attendance', icon: ClipboardCheck, desc: 'Tracker' },
        { id: 'lostfound', label: 'Lost & Found', icon: SearchIcon, desc: 'Campus items' },
        { id: 'schedule', label: 'Schedule', icon: Calendar, desc: 'Class Sessions' },
      ];

  // --- Computed Data ---
  const attendanceStats = useMemo(() => {
    if (isTeacher || myAttendance.length === 0) return { percent: 0, streak: 0, present: 0, late: 0, absent: 0, total: 0 };

    let totalClasses = 0;
    let totalPresent = 0;
    let totalLate = 0;
    let totalAbsent = 0;
    let allEntries: AttendanceEntry[] = [];

    myAttendance.forEach(sub => {
      sub.entries.forEach(e => {
          totalClasses++;
          allEntries.push(e);
          if (e.status === 'present') totalPresent++;
          else if (e.status === 'late') totalLate++;
          else if (e.status === 'absent') totalAbsent++;
      });
    });

    const percent = totalClasses === 0 ? 100 : Math.round(((totalPresent + totalLate) / totalClasses) * 100);

    // Streak Calculation
    // Sort entries by timestamp desc
    allEntries.sort((a, b) => b.timestamp - a.timestamp);
    
    // Get unique dates
    const uniqueDates = Array.from(new Set(allEntries.map(e => new Date(e.timestamp).toDateString())));
    
    let streak = 0;
    // Simple logic: if the most recent date is today or yesterday, start counting backwards
    // Note: This is a basic streak implementation based on dates with presence
    if (uniqueDates.length > 0) {
        // Check consecutive days
        // For simulation, we just count how many unique dates have 'present' or 'late'
        // In a real app, we'd check date continuity. Here we assume entries imply continuity for the visual.
        // Let's count consecutive entries that are NOT 'absent' from the sorted list
        let currentStreak = 0;
        for (const entry of allEntries) {
            if (entry.status !== 'absent') currentStreak++;
            else break;
        }
        streak = currentStreak; 
    }

    return { percent, streak, present: totalPresent, late: totalLate, absent: totalAbsent, total: totalClasses };
  }, [attendance, myAttendance, session.email, isTeacher]);

  const feedItems = useMemo(() => {
    let all: Post[] = [];
    
    // Explicitly handle Announcement view for both roles
    if (activeTab === 'announcements') return announcements.sort((a,b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    // Student View: Mixed feed
    if (filter === 'all') {
      all = all.concat(announcements).concat(lostFound);
      (Object.values(discussions) as Post[][]).forEach(list => all = all.concat(list));
    } else if (filter === 'discussion') {
       (Object.values(discussions) as Post[][]).forEach(list => all = all.concat(list));
    } else if (filter === 'lostfound') {
      all = lostFound;
    }

    if (search) {
      const lower = search.toLowerCase();
      all = all.filter(p => 
        (p.title?.toLowerCase().includes(lower)) || 
        p.desc.toLowerCase().includes(lower) || 
        p.author.toLowerCase().includes(lower)
      );
    }

    return all.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [announcements, discussions, lostFound, filter, search, activeTab]);

  // --- Render Helpers ---

  const renderAttendance = () => {
    const { percent, streak, present, late, absent, total } = attendanceStats;
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Welcome back, {session.email.split('@')[0]}</h1>
          <p className="text-muted">{todayStr}</p>
        </div>
        <div className="flex items-center gap-3">
            <span className="bg-panel px-3 py-1.5 rounded-lg text-xs font-bold text-muted border border-white/5 uppercase tracking-wider">
                TODAY
            </span>
            <button 
                onClick={() => {
                    if (myAttendance.length === 0) {
                        alert("Please add a subject first below.");
                        setIsAddingSubject(true);
                        return;
                    }
                    setShowMarkAttendanceModal(true);
                    setSelectedSubjectForMark(myAttendance[0].id);
                }}
                className="flex items-center gap-2 bg-white text-bg1 px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors"
            >
                Mark Attendance <ArrowRight size={16} />
            </button>
        </div>
      </div>

      {/* Main Score Card */}
      <div className="bg-panel border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex justify-between items-end mb-4">
            <div>
                <h2 className="text-lg font-bold text-white mb-1">Attendance Score</h2>
                <p className="text-muted text-sm">{percent >= 90 ? "You're doing great! Keep it up!" : "You're below the target. Catch up!"}</p>
            </div>
            <div className="text-right">
                <div className="text-4xl font-bold text-brand-purple mb-1">{percent}%</div>
                <div className="text-xs text-muted font-medium">Target: 90%</div>
            </div>
        </div>
        <div className="w-full h-3 bg-bg2 rounded-full overflow-hidden">
            <div className="h-full bg-brand-purple rounded-full transition-all duration-1000 ease-out" style={{ width: `${percent}%` }}></div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Streak */}
        <div className="bg-panel border border-white/5 border-l-4 border-l-green-500 rounded-xl p-5 shadow-lg">
            <div className="flex justify-between items-start mb-2">
                <span className="text-sm text-muted font-medium">Current Streak</span>
                <div className="p-2 bg-green-500/10 rounded-lg text-green-500"><TrendingUp size={18} /></div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{streak} <span className="text-base font-normal text-muted">Days</span></div>
            <div className="text-xs text-muted">Consecutive attendance</div>
        </div>

        {/* Present */}
        <div className="bg-panel border border-white/5 border-l-4 border-l-brand-purple rounded-xl p-5 shadow-lg">
            <div className="flex justify-between items-start mb-2">
                <span className="text-sm text-muted font-medium">Days Present</span>
                <div className="p-2 bg-brand-purple/10 rounded-lg text-brand-purple"><CheckCircle size={18} /></div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{present}</div>
            <div className="text-xs text-muted">Total present entries</div>
        </div>

        {/* Late */}
        <div className="bg-panel border border-white/5 border-l-4 border-l-brand-orange rounded-xl p-5 shadow-lg">
            <div className="flex justify-between items-start mb-2">
                <span className="text-sm text-muted font-medium">Days Late</span>
                <div className="p-2 bg-brand-orange/10 rounded-lg text-brand-orange"><Clock size={18} /></div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{late}</div>
            <div className="text-xs text-muted">Total late arrivals</div>
        </div>

        {/* Absent */}
        <div className="bg-panel border border-white/5 border-l-4 border-l-brand-pink rounded-xl p-5 shadow-lg">
            <div className="flex justify-between items-start mb-2">
                <span className="text-sm text-muted font-medium">Days Absent</span>
                <div className="p-2 bg-brand-pink/10 rounded-lg text-brand-pink"><AlertCircle size={18} /></div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{absent}</div>
            <div className="text-xs text-muted">Missed classes</div>
        </div>
      </div>

      {/* Distribution & Subject Management Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <div className="lg:col-span-1 bg-panel border border-white/10 rounded-2xl p-6">
            <h3 className="font-bold text-white mb-6">Status Distribution</h3>
            <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-brand-purple"></div>
                        <span className="text-muted">Present</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-24 h-1.5 bg-bg2 rounded-full overflow-hidden">
                             <div className="h-full bg-brand-purple" style={{ width: `${total > 0 ? (present/total)*100 : 0}%` }}></div>
                        </div>
                        <span className="text-white font-bold w-8 text-right">{total > 0 ? Math.round((present/total)*100) : 0}%</span>
                    </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-brand-orange"></div>
                        <span className="text-muted">Late</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-24 h-1.5 bg-bg2 rounded-full overflow-hidden">
                             <div className="h-full bg-brand-orange" style={{ width: `${total > 0 ? (late/total)*100 : 0}%` }}></div>
                        </div>
                        <span className="text-white font-bold w-8 text-right">{total > 0 ? Math.round((late/total)*100) : 0}%</span>
                    </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-brand-pink"></div>
                        <span className="text-muted">Absent</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-24 h-1.5 bg-bg2 rounded-full overflow-hidden">
                             <div className="h-full bg-brand-pink" style={{ width: `${total > 0 ? (absent/total)*100 : 0}%` }}></div>
                        </div>
                        <span className="text-white font-bold w-8 text-right">{total > 0 ? Math.round((absent/total)*100) : 0}%</span>
                    </div>
                </div>
            </div>
            
            {/* Visual Pie Placeholder */}
            <div className="mt-8 flex justify-center">
                 <div className="relative w-32 h-32 rounded-full border-8 border-bg2 flex items-center justify-center bg-gradient-to-tr from-brand-purple via-brand-orange to-brand-pink opacity-80">
                    <div className="absolute inset-2 bg-panel rounded-full flex items-center justify-center">
                        <PieChart size={32} className="text-muted" />
                    </div>
                 </div>
            </div>
        </div>

        {/* Subjects List */}
        <div className="lg:col-span-2 bg-panel border border-white/10 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-white">Your Subjects</h3>
                <button 
                  onClick={() => setIsAddingSubject(true)} 
                  className="text-xs font-bold text-brand-orange hover:text-white transition-colors flex items-center gap-1"
                >
                  <Plus size={14} /> ADD SUBJECT
                </button>
            </div>

            {isAddingSubject && (
                <div className="mb-4 bg-bg2 border border-white/10 rounded-xl p-4 flex gap-2 animate-in fade-in slide-in-from-top-2">
                    <input 
                        autoFocus
                        placeholder="Subject Name (e.g. Data Structures)" 
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
                        className="flex-1 bg-panel border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-brand-purple/50 text-sm"
                    />
                    <button onClick={handleAddSubject} className="bg-brand-purple text-white px-4 rounded-lg font-bold text-xs">Add</button>
                    <button onClick={() => setIsAddingSubject(false)} className="bg-white/5 text-muted hover:text-white px-3 rounded-lg"><X size={16} /></button>
                </div>
            )}

            <div className="space-y-3">
                {myAttendance.length === 0 ? (
                    <div className="text-center text-muted text-sm py-4">No subjects added yet. Add one to track attendance.</div>
                ) : (
                    myAttendance.map(sub => {
                        const subTotal = sub.entries.length;
                        const subPresent = sub.entries.filter(e => e.status === 'present').length + sub.entries.filter(e => e.status === 'late').length; // Counting late as present for progress
                        const subPercent = subTotal === 0 ? 0 : Math.round((subPresent / subTotal) * 100);
                        
                        return (
                            <div key={sub.id} className="flex items-center gap-4 p-3 rounded-xl bg-bg2/50 border border-white/5 hover:border-white/10 transition-all group">
                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center font-bold text-muted text-sm shrink-0">
                                    {sub.name.substring(0,2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between mb-1">
                                        <h4 className="font-bold text-sm text-white truncate">{sub.name}</h4>
                                        <span className={`text-xs font-bold ${subPercent >= 75 ? 'text-green-400' : 'text-red-400'}`}>{subPercent}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-bg1 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${subPercent >= 75 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${subPercent}%` }}></div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleDeleteSubject(sub.id)}
                                    className="p-2 text-white/20 hover:text-red-400 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
      </div>

      {/* Mark Attendance Modal */}
      {showMarkAttendanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-panel border border-white/10 w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
                <button 
                    onClick={() => setShowMarkAttendanceModal(false)}
                    className="absolute top-4 right-4 text-muted hover:text-white"
                >
                    <X size={20} />
                </button>
                
                <h3 className="text-xl font-bold text-white mb-1">Mark Attendance</h3>
                <p className="text-sm text-muted mb-6">Select a subject and your status for today.</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-muted uppercase mb-2">Subject</label>
                        <select 
                            value={selectedSubjectForMark}
                            onChange={(e) => setSelectedSubjectForMark(e.target.value)}
                            className="w-full bg-bg2 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-brand-purple/50"
                        >
                            {myAttendance.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-muted uppercase mb-2">Status</label>
                        <div className="grid grid-cols-3 gap-3">
                            <button 
                                onClick={() => setAttendanceStatus('present')}
                                className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border transition-all ${
                                    attendanceStatus === 'present' 
                                    ? 'bg-brand-purple/20 border-brand-purple text-white' 
                                    : 'bg-bg2 border-white/5 text-muted hover:bg-white/5'
                                }`}
                            >
                                <CheckCircle size={20} className={attendanceStatus === 'present' ? 'text-brand-purple' : ''} />
                                <span className="text-xs font-bold">Present</span>
                            </button>
                            <button 
                                onClick={() => setAttendanceStatus('late')}
                                className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border transition-all ${
                                    attendanceStatus === 'late' 
                                    ? 'bg-brand-orange/20 border-brand-orange text-white' 
                                    : 'bg-bg2 border-white/5 text-muted hover:bg-white/5'
                                }`}
                            >
                                <Clock size={20} className={attendanceStatus === 'late' ? 'text-brand-orange' : ''} />
                                <span className="text-xs font-bold">Late</span>
                            </button>
                            <button 
                                onClick={() => setAttendanceStatus('absent')}
                                className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border transition-all ${
                                    attendanceStatus === 'absent' 
                                    ? 'bg-brand-pink/20 border-brand-pink text-white' 
                                    : 'bg-bg2 border-white/5 text-muted hover:bg-white/5'
                                }`}
                            >
                                <AlertCircle size={20} className={attendanceStatus === 'absent' ? 'text-brand-pink' : ''} />
                                <span className="text-xs font-bold">Absent</span>
                            </button>
                        </div>
                    </div>

                    <button 
                        onClick={handleManualAttendanceSubmit}
                        className="w-full py-3.5 bg-gradient-to-r from-brand-orange to-brand-pink text-bg1 font-bold rounded-xl mt-4 hover:opacity-90 shadow-lg shadow-brand-orange/20"
                    >
                        Save Entry
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
    );
  };

  const renderSchedule = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Upcoming Lectures</h2>
      
      {/* Teacher Form */}
      {isTeacher && (
        <div className="bg-panel border border-white/5 rounded-xl p-5">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Plus size={16}/> Add New Session</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
             <input placeholder="Subject (e.g. Physics)" className="bg-bg2 border border-white/10 rounded-lg p-2 text-sm text-white" value={newLecture.subject} onChange={e => setNewLecture({...newLecture, subject: e.target.value})} />
             <input placeholder="Topic (e.g. Gravity)" className="bg-bg2 border border-white/10 rounded-lg p-2 text-sm text-white" value={newLecture.topic} onChange={e => setNewLecture({...newLecture, topic: e.target.value})} />
             <input placeholder="Time (e.g. 10:00 AM)" className="bg-bg2 border border-white/10 rounded-lg p-2 text-sm text-white" value={newLecture.time} onChange={e => setNewLecture({...newLecture, time: e.target.value})} />
             <input placeholder="Room (e.g. 302)" className="bg-bg2 border border-white/10 rounded-lg p-2 text-sm text-white" value={newLecture.room} onChange={e => setNewLecture({...newLecture, room: e.target.value})} />
          </div>
          <button onClick={handleAddLecture} className="bg-brand-purple hover:bg-brand-purple/80 text-white px-4 py-2 rounded-lg text-sm font-bold">Add to Schedule</button>
        </div>
      )}

      {/* Schedule List */}
      <div className="grid gap-4">
        {lectures.length === 0 ? <div className="text-muted text-sm">No lectures scheduled.</div> : lectures.map(lec => (
          <div key={lec.id} className="bg-panel border border-white/5 p-4 rounded-xl flex justify-between items-center hover:border-white/20 transition-all">
            <div className="flex gap-4 items-center">
              <div className="bg-brand-orange/10 text-brand-orange p-3 rounded-lg font-bold">
                 {lec.time}
              </div>
              <div>
                <h4 className="font-bold text-white text-lg">{lec.subject}</h4>
                <div className="text-sm text-muted">{lec.topic} • {lec.teacherName}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted bg-white/5 px-3 py-1 rounded-full">
              <MapPin size={14} /> {lec.room}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Reusable Sidebar Component
  // isMobile=true means text is always visible
  // isMobile=false means text reveals on group-hover
  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="space-y-1 py-2">
      <div className={`text-xs font-bold text-muted px-4 py-2 mb-2 transition-opacity duration-300 ${!isMobile ? 'opacity-0 group-hover:opacity-100' : ''}`}>
        MENU
      </div>
      {SIDEBAR_ITEMS.map(item => (
        <button
          key={item.id}
          onClick={() => { 
            setActiveTab(item.id); 
            setFilter(item.id === 'home' ? 'all' : item.id as any);
            setMobileMenuOpen(false); // Close mobile menu if open
          }}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all relative overflow-hidden ${
            activeTab === item.id 
              ? 'bg-gradient-to-r from-white/10 to-white/5 text-white shadow-lg' 
              : 'text-muted hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className={`p-2 rounded-lg shrink-0 transition-colors ${activeTab === item.id ? 'bg-white/10' : 'bg-panel group-hover:bg-white/5'}`}>
            <item.icon size={20} />
          </div>
          <div className={`text-left whitespace-nowrap overflow-hidden transition-all duration-300 ${
            isMobile 
              ? 'opacity-100' 
              : 'max-w-0 opacity-0 group-hover:max-w-[200px] group-hover:opacity-100'
          }`}>
            <div className="font-semibold text-sm pl-1">{item.label}</div>
            <div className="text-[10px] opacity-60 font-normal pl-1">{item.desc}</div>
          </div>
        </button>
      ))}
      
      {!isTeacher && (
        <div className={`mt-8 mx-3 p-4 rounded-xl bg-gradient-to-b from-white/5 to-transparent border border-white/5 transition-all duration-300 overflow-hidden ${
          !isMobile ? 'opacity-0 group-hover:opacity-100 h-0 group-hover:h-auto' : ''
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-orange to-brand-purple">
              {attendanceStats.percent}%
            </div>
          </div>
          <div className="text-xs text-muted mb-3 whitespace-nowrap">Average Attendance</div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-brand-orange to-brand-purple" style={{ width: `${attendanceStats.percent}%` }}></div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-bg1 to-bg2 text-gray-100 font-sans">
      
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="relative w-72 h-full bg-[#0b0b10] border-r border-white/10 p-4 shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex justify-between items-center mb-6 pl-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-orange to-brand-purple flex items-center justify-center font-bold text-bg1 text-sm">CC</div>
                <span className="font-bold text-lg">Menu</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-muted hover:text-white bg-white/5 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <SidebarContent isMobile={true} />
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-bg1/80 backdrop-blur-md border-b border-white/5 px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          {/* Mobile Menu Trigger */}
          <button 
            onClick={() => setMobileMenuOpen(true)} 
            className="lg:hidden p-2 -ml-2 text-muted hover:text-white rounded-lg hover:bg-white/5"
          >
            <Menu size={24} />
          </button>

          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-orange to-brand-purple flex items-center justify-center font-bold text-bg1">CC</div>
          <div>
            <h1 className="font-bold text-lg leading-tight">CampusConnect</h1>
            <p className="text-xs text-muted">{isTeacher ? 'Teacher Portal' : 'Student Dashboard'}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center bg-panel border border-white/10 rounded-lg px-3 py-2 w-64 focus-within:border-brand-purple/50 transition-colors">
            <SearchIcon size={16} className="text-muted mr-2" />
            <input 
              id="globalSearch"
              type="text" 
              placeholder="Search feed (press /)" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-full placeholder-muted/50"
            />
          </div>

          <div className="relative group">
             <button className="p-2 rounded-lg hover:bg-white/5 relative">
               <Bell size={20} className="text-muted" />
               {alerts.length > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-brand-pink rounded-full border border-bg1"></span>}
             </button>
             {/* Simple Notifications Dropdown */}
             <div className="absolute right-0 top-full mt-2 w-72 bg-[#0f1013] border border-white/10 rounded-xl shadow-2xl p-2 hidden group-hover:block">
               <div className="text-xs font-bold text-muted px-2 py-1 mb-1">NOTIFICATIONS</div>
               {alerts.length === 0 ? (
                 <div className="p-2 text-sm text-muted">No new alerts</div>
               ) : (
                 alerts.map(a => (
                   <div key={a.id} className="p-2 hover:bg-white/5 rounded-lg mb-1">
                     <p className="text-sm font-semibold text-brand-pink">{a.text}</p>
                     <p className="text-[10px] text-muted">{a.time}</p>
                   </div>
                 ))
               )}
             </div>
          </div>

          <div className="relative">
            <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 transition-all">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-brand-orange to-brand-pink flex items-center justify-center text-xs font-bold text-bg1">
                {session.email[0].toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-sm font-bold leading-none">{session.role.toUpperCase()}</div>
                <div className="text-[10px] text-muted leading-none">{session.email.split('@')[0]}</div>
              </div>
              <MoreVertical size={14} className="text-muted" />
            </button>
            
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#0f1013] border border-white/10 rounded-xl shadow-2xl p-1 z-50">
                <button onClick={onLogout} className="w-full text-left px-3 py-2 text-sm hover:bg-red-500/10 text-red-400 rounded-lg flex items-center gap-2">
                  <LogOut size={14} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="max-w-[1400px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-[80px_1fr] xl:grid-cols-[80px_1fr_300px] gap-6">
        
        {/* Sidebar - Desktop: Sticky rail that expands on hover */}
        <aside className="hidden lg:block sticky top-24 h-[calc(100vh-100px)] z-30">
          <div className="group absolute top-0 left-0 h-full">
            <div className="w-20 group-hover:w-72 bg-[#0b0b10]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl transition-all duration-300 ease-in-out overflow-hidden h-full flex flex-col">
               <SidebarContent isMobile={false} />
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0">
          
          {/* Global Alert Banner */}
          {alerts.length > 0 && activeTab !== 'tutor' && activeTab !== 'chat' && activeTab !== 'attendance' && (
            <div className="mb-6 bg-gradient-to-r from-red-500/20 to-brand-pink/20 border border-red-500/30 rounded-xl p-4 flex items-start justify-between">
              <div className="flex gap-3">
                <AlertTriangle className="text-red-400 shrink-0" />
                <div>
                  <h3 className="font-bold text-red-100 text-sm">Campus Alert</h3>
                  <p className="text-sm text-red-200/80">{alerts[alerts.length - 1].text}</p>
                </div>
              </div>
              <button onClick={() => setAlerts([])} className="text-xs text-red-300 hover:text-white underline">Dismiss</button>
            </div>
          )}

          {/* --- VIEW: TUTOR CHAT (TEACHER CHAT SYSTEM) --- */}
          {(activeTab === 'tutor' || activeTab === 'chat') ? (
            <TutorChat session={session} />
          ) : (activeTab === 'lectures' || activeTab === 'schedule') ? (
            renderSchedule()
          ) : activeTab === 'attendance' ? (
            renderAttendance()
          ) : (
            <>
              {/* --- VIEW: FEED (Home / Announcements / LostFound) --- */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">
                  {activeTab === 'announcements' ? 'Announcements Board' : 
                   activeTab === 'home' ? 'Unified Feed' : 
                   activeTab === 'discussion' ? 'Student Discussions' : 'Lost & Found'}
                </h2>
                
                {/* Create Button Logic: Teachers can create in announcements, Students in discussion/lostfound */}
                {(!isTeacher || activeTab === 'announcements') && (
                  <button 
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-orange to-brand-pink text-bg1 font-bold text-sm rounded-lg hover:opacity-90 shadow-lg shadow-brand-orange/20"
                  >
                    <Plus size={16} /> Create Post
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {feedItems.length === 0 ? (
                  <div className="text-center py-12 text-muted">No posts found in this category.</div>
                ) : (
                  feedItems.map(post => (
                    <div key={post.id} className="p-5 rounded-xl bg-panel border border-white/5 hover:border-white/10 transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            post.type === 'announcement' ? 'bg-brand-purple' : 
                            post.type === 'lostfound' ? 'bg-red-500' : 'bg-green-400'
                          }`} />
                          <span className="text-xs font-bold uppercase tracking-wider text-muted">{post.type}</span>
                        </div>
                        <span className="text-xs text-muted/60">{post.time}</span>
                      </div>
                      
                      <h4 className="text-lg font-bold text-white mb-2">{post.title || (post.desc.length > 50 ? post.desc.slice(0,50)+'...' : post.desc)}</h4>
                      <p className="text-gray-400 text-sm leading-relaxed mb-4">{post.desc}</p>
                      
                      <div className="flex justify-between items-center pt-3 border-t border-white/5">
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <User size={12} />
                          {post.author}
                        </div>

                        <div className="flex gap-3 items-center">
                          {/* Student Reacts */}
                          {!isTeacher && post.type === 'announcement' && (
                            <button onClick={() => handleLike(post)} className="flex items-center gap-1 text-xs text-muted hover:text-brand-pink transition-colors">
                              <Heart size={14} className={post.likes > 0 ? "fill-brand-pink text-brand-pink" : ""} /> {post.likes}
                            </button>
                          )}
                          
                          {/* Comments Trigger */}
                          <button 
                            onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)} 
                            className={`flex items-center gap-1 text-xs transition-colors ${expandedPostId === post.id ? 'text-brand-orange' : 'text-muted hover:text-white'}`}
                          >
                            <MessageCircle size={14} /> 
                            {post.comments?.length || 0}
                          </button>

                          {/* Admin Controls */}
                          {isPrivileged && post.type === 'lostfound' && (
                             <button onClick={() => toggleHighAlert(post)} className={`text-xs ${post.highAlert ? 'text-red-400' : 'text-muted hover:text-white'}`}>
                               {post.highAlert ? 'High Alert Active' : 'Set Alert'}
                             </button>
                          )}
                          
                          {isPrivileged && post.type === 'announcement' && (
                            <>
                              <div className="text-xs text-muted flex items-center gap-1 mr-2"><Heart size={14}/> {post.likes}</div>
                              <button 
                                onClick={() => handleDeletePost(post)}
                                className="text-xs text-muted hover:text-red-400 flex items-center gap-1 transition-colors"
                              >
                                <Trash2 size={14} /> 
                                <span className="hidden sm:inline">Delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Comments Section */}
                      {expandedPostId === post.id && (
                        <div className="mt-4 pt-4 border-t border-white/5">
                            {post.comments?.length > 0 && (
                                <div className="space-y-3 mb-4">
                                    {post.comments.map(c => (
                                        <div key={c.id} className="flex gap-2">
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-[10px] font-bold shrink-0">
                                                {c.author.split('@')[0][0].toUpperCase()}
                                            </div>
                                            <div className="bg-white/5 rounded-lg rounded-tl-none p-2 text-sm flex-1">
                                                <div className="flex justify-between items-baseline mb-1">
                                                    <span className="font-bold text-xs text-gray-300">{c.author.split('@')[0]}</span>
                                                    <span className="text-[10px] text-muted">{c.time.split(',')[0]}</span>
                                                </div>
                                                <p className="text-gray-300">{c.text}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            <div className="flex gap-2 items-center">
                                <input 
                                    type="text" 
                                    placeholder="Add a reply..." 
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post)}
                                    className="flex-1 bg-bg2 border border-white/10 rounded-full px-4 py-2 text-sm text-white focus:border-brand-purple/50 outline-none placeholder-muted/50"
                                />
                                <button 
                                    onClick={() => handleAddComment(post)}
                                    disabled={!commentText.trim()}
                                    className="p-2 bg-brand-purple hover:bg-brand-purple/80 text-white rounded-full disabled:opacity-50 transition-colors"
                                >
                                    <Send size={14} />
                                </button>
                            </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </main>

        {/* Right Panel (Widgets) - Only show relevant widgets */}
        <aside className="hidden xl:block space-y-6">
          {isTeacher ? (
             <div className="bg-panel rounded-xl p-5 border border-white/5">
               <h3 className="font-bold text-white mb-3">Quick Actions</h3>
               <button onClick={() => { setActiveTab('announcements'); setShowModal(true); }} className="w-full text-left mb-2 text-sm text-muted hover:text-white flex items-center gap-2">
                 <Plus size={16} /> Post Announcement
               </button>
               <button onClick={() => setActiveTab('lectures')} className="w-full text-left text-sm text-muted hover:text-white flex items-center gap-2">
                 <Calendar size={16} /> Update Schedule
               </button>
             </div>
          ) : (
             <div className="bg-panel rounded-xl p-5 border border-white/5">
                <h3 className="font-bold text-white mb-1">Upcoming Class</h3>
                {lectures.length > 0 ? (
                  <>
                    <p className="text-sm font-bold text-brand-orange mt-2">{lectures[0].subject}</p>
                    <p className="text-xs text-muted">{lectures[0].time} • {lectures[0].room}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted mt-2">No classes scheduled</p>
                )}
             </div>
          )}
        </aside>

      </div>

      {showModal && (
        <CreatePostModal 
          onClose={() => setShowModal(false)} 
          onSubmit={handlePostSubmit} 
          session={session}
        />
      )}
    </div>
  );
};

export default Dashboard;
