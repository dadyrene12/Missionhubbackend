import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Home, Building, Briefcase, Users, FileCode, Calendar,
  CreditCard, Users2, Video, MessageSquare, BarChart3,
  Settings as SettingsIcon, Bell, Search, Plus, ChevronLeft, ChevronRight,
  Menu, X, User, LogOut, Moon, Sun, Download, Filter,
  AlertCircle, CheckCircle, Loader2, Info, TrendingUp,
  Clock, DollarSign, MapPin, Award, Target, Zap
} from 'lucide-react';

import { apiRequest, API_BASE_URL } from '../utils/api';

// ==================== INLINE PLACEHOLDER COMPONENTS ====================
const DashboardOverview = ({ stats = {}, applicants = [], jobs = [], onViewAll, onNewJob, onViewItem }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* Stats Grid */}
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Active Jobs</p>
              <p className="text-3xl font-bold text-gray-900">{stats.activeJobs || 0}</p>
            </div>
            <Briefcase className="w-12 h-12 p-3 bg-blue-100 text-blue-600 rounded-2xl" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Pending Applicants</p>
              <p className="text-3xl font-bold text-gray-900">{stats.pendingApplicants || 0}</p>
            </div>
            <Users className="w-12 h-12 p-3 bg-orange-100 text-orange-600 rounded-2xl" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Upcoming Exams</p>
              <p className="text-3xl font-bold text-gray-900">{stats.upcomingExams || 0}</p>
            </div>
            <FileCode className="w-12 h-12 p-3 bg-purple-100 text-purple-600 rounded-2xl" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Talent Pool</p>
              <p className="text-3xl font-bold text-gray-900">{stats.talentPoolCount || 0}</p>
            </div>
            <Users2 className="w-12 h-12 p-3 bg-green-100 text-green-600 rounded-2xl" />
          </div>
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Quick Actions</h3>
          <Plus className="w-6 h-6 opacity-75" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button onClick={onNewJob} className="group bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/20 transition-all">
            <div className="flex items-center mb-2">
              <Briefcase className="w-5 h-5 mr-3" />
              <span className="font-semibold">Post New Job</span>
            </div>
            <p className="text-sm opacity-75">Attract top talent now</p>
          </button>
          <button className="group bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/20 transition-all">
            <div className="flex items-center mb-2">
              <Users className="w-5 h-5 mr-3" />
              <span className="font-semibold">Review Applicants</span>
            </div>
            <p className="text-sm opacity-75">{stats.pendingApplicants || 0} pending</p>
          </button>
          <button className="group bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/20 transition-all">
            <div className="flex items-center mb-2">
              <FileCode className="w-5 h-5 mr-3" />
              <span className="font-semibold">Schedule Exam</span>
            </div>
            <p className="text-sm opacity-75">Assess candidates</p>
          </button>
        </div>
      </div>
    </div>

    {/* Recent Activity */}
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Users className="w-6 h-6 text-blue-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Recent Applicants</h3>
              <p className="text-sm text-gray-500">Latest applications</p>
            </div>
          </div>
          <button onClick={onViewAll} className="text-sm font-medium text-blue-600 hover:text-blue-700">View All →</button>
        </div>
        <div className="space-y-3">
          {applicants.slice(0, 3).map((applicant, i) => (
            <div key={i} onClick={() => onViewItem?.(applicant)} className="flex items-center p-4 hover:bg-gray-50 rounded-lg cursor-pointer group transition-colors">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-semibold text-sm mr-4">
                {applicant.name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 group-hover:text-gray-700">{applicant.name}</p>
                <p className="text-sm text-gray-500">{applicant.jobTitle}</p>
              </div>
              <div className="text-sm text-gray-500">{new Date(applicant.date).toLocaleDateString()}</div>
            </div>
          ))}
          {applicants.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No recent applicants</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Calendar className="w-6 h-6 text-green-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <p className="text-sm text-gray-500">Latest updates</p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {jobs.slice(0, 3).map((job, i) => (
            <div key={i} className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-4"></div>
              <div className="flex-1">
                <p className="font-medium text-sm text-gray-900">New applicant for "{job.title}"</p>
                <p className="text-xs text-gray-500">{new Date().toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const CompanyProfile = ({ profile = {}, onEdit, onUpdate, uploadFile }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-2xl font-bold text-gray-900">Company Profile</h2>
      <button 
        onClick={onEdit}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
      >
        Edit Profile
      </button>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600 mb-2 block">Company Name</label>
            <p className="text-lg font-semibold text-gray-900">{profile?.companyName || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 mb-2 block">Email</label>
            <p className="text-sm text-gray-900">{profile?.companyEmail || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 mb-2 block">Industry</label>
            <p className="text-sm text-gray-900">{profile?.industry || 'N/A'}</p>
          </div>
        </div>
      </div>
      <div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600 mb-2 block">Company Size</label>
            <p className="text-sm text-gray-900">{profile?.companySize || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 mb-2 block">Website</label>
            <p className="text-sm text-blue-600 hover:underline">{profile?.website || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 mb-2 block">Location</label>
            <p className="text-sm text-gray-900">{profile?.location || 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
    <div className="mt-6 pt-6 border-t border-gray-100">
      <label className="text-sm font-medium text-gray-600 mb-3 block">About Company</label>
      <p className="text-gray-700 leading-relaxed">{profile?.description || 'Add a description about your company to attract more talent.'}</p>
    </div>
  </div>
);

const JobManagement = ({ jobs = [], onCreate, onEdit, onDelete, onShare, onViewApplicants }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Job Management</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your active job postings</p>
      </div>
      <button 
        onClick={onCreate}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
      >
        + New Job
      </button>
    </div>
    <div className="space-y-4">
      {jobs && jobs.length > 0 ? (
        jobs.map((job) => (
          <div key={job._id || job.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{job.title}</h3>
                  <p className="text-sm text-gray-600">{job.company}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => onEdit(job)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button 
                  onClick={() => onDelete(job._id || job.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-12">
          <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs posted yet</h3>
          <p className="text-gray-500 mb-6">Get started by creating your first job listing</p>
          <button 
            onClick={onCreate}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Create First Job
          </button>
        </div>
      )}
    </div>
  </div>
);

const ApplicantManagement = ({ applicants = [], onUpdateStatus, onMessage, onAddToTalentPool, onScheduleInterview, onExport, searchTerm, statusFilter, selectedJob, onSearchChange, onStatusFilterChange, onJobFilterChange, jobs }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-2xl font-bold text-gray-900">Applicant Management</h2>
      <button 
        onClick={onExport}
        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium flex items-center"
      >
        <Download className="w-4 h-4 mr-2" />
        Export
      </button>
    </div>
    
    {/* Filters */}
    <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      <input
        type="text"
        placeholder="Search applicants..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">All Status</option>
        <option value="pending">Pending</option>
        <option value="reviewed">Reviewed</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
      <select
        value={selectedJob?._id || selectedJob?.id || ''}
        onChange={(e) => onJobFilterChange(jobs?.find(j => (j._id || j.id) === e.target.value))}
        className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Jobs</option>
        {jobs?.map(job => (
          <option key={job._id || job.id} value={job._id || job.id}>{job.title}</option>
        ))}
      </select>
    </div>
    
    <div className="space-y-4">
      {applicants && applicants.length > 0 ? (
        applicants.map((applicant) => (
          <div key={applicant._id || applicant.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{applicant.applicantName}</h3>
                  <p className="text-sm text-gray-600">{applicant.applicantEmail}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <select 
                  value={applicant.status || 'pending'}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => onUpdateStatus(applicant._id || applicant.id, e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <button
                  onClick={() => onMessage(applicant)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No applicants yet</h3>
          <p className="text-gray-500">Applicants will appear here once candidates apply</p>
        </div>
      )}
    </div>
  </div>
);

const ExamManagement = ({ exams = [], jobs = [], applicants = [], onCreate, onEdit, onDelete, onStart, onViewResults }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Exam Management</h2>
        <p className="text-sm text-gray-500 mt-1">Create and manage technical assessments</p>
      </div>
      <button 
        onClick={onCreate}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
      >
        + New Exam
      </button>
    </div>
    <div className="space-y-4">
      {exams && exams.length > 0 ? (
        exams.map((exam) => (
          <div key={exam._id || exam.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{exam.title}</h3>
                <p className="text-sm text-gray-600">Duration: {exam.duration} mins | Questions: {exam.questions?.length || 0}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => onEdit(exam)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button 
                  onClick={() => onDelete(exam._id || exam.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-12">
          <FileCode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No exams created yet</h3>
          <p className="text-gray-500 mb-6">Create exams to assess candidate skills</p>
          <button 
            onClick={onCreate}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Create First Exam
          </button>
        </div>
      )}
    </div>
  </div>
);

const ActivityManagement = ({ activities = [], onCreate, onEdit, onDelete, onPromote }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Activities</h2>
        <p className="text-sm text-gray-500 mt-1">Track company activities and events</p>
      </div>
      <button 
        onClick={onCreate}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
      >
        + New Activity
      </button>
    </div>
    <div className="space-y-4">
      {activities && activities.length > 0 ? (
        activities.map((activity) => (
          <div key={activity._id || activity.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{activity.title}</h3>
                  <p className="text-sm text-gray-600">{new Date(activity.date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => onEdit(activity)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button 
                  onClick={() => onDelete(activity._id || activity.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No activities yet</h3>
          <p className="text-gray-500">Activities will appear here as you engage with candidates</p>
        </div>
      )}
    </div>
  </div>
);

const AdManagement = ({ advertisements = [], packages = [], onCreate, onEdit, onDelete, onRenew }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Ad Management</h2>
        <p className="text-sm text-gray-500 mt-1">Promote your jobs to reach more candidates</p>
      </div>
      <button 
        onClick={onCreate}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
      >
        + New Ad
      </button>
    </div>
    <div className="space-y-4">
      {advertisements && advertisements.length > 0 ? (
        advertisements.map((ad) => (
          <div key={ad._id || ad.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{ad.title}</h3>
                <p className="text-sm text-gray-600">Status: {ad.status} | Impressions: {ad.impressions || 0}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => onEdit(ad)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button 
                  onClick={() => onDelete(ad._id || ad.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-12">
          <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No active ads</h3>
          <p className="text-gray-500 mb-6">Promote your jobs to reach more qualified candidates</p>
          <button 
            onClick={onCreate}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Create First Ad
          </button>
        </div>
      )}
    </div>
  </div>
);

const TalentPool = ({ candidates = [], onRemove, onContact, onScheduleInterview }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Talent Pool</h2>
        <p className="text-sm text-gray-500 mt-1">Saved candidates for future opportunities</p>
      </div>
    </div>
    <div className="space-y-4">
      {candidates && candidates.length > 0 ? (
        candidates.map((candidate) => (
          <div key={candidate._id || candidate.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{candidate.name}</h3>
                <p className="text-sm text-gray-600">{candidate.email}</p>
                <p className="text-xs text-gray-500 mt-1">Skills: {candidate.skills?.join(', ') || 'N/A'}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onContact(candidate)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onRemove(candidate._id || candidate.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-12">
          <Users2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No candidates in talent pool</h3>
          <p className="text-gray-500">Save promising candidates for future positions</p>
        </div>
      )}
    </div>
  </div>
);

const InterviewManagement = ({ interviews = [], applicants = [], onCreate, onEdit, onCancel, onJoin }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Interview Management</h2>
        <p className="text-sm text-gray-500 mt-1">Schedule and manage interviews</p>
      </div>
      <button 
        onClick={onCreate}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
      >
        + Schedule Interview
      </button>
    </div>
    <div className="space-y-4">
      {interviews && interviews.length > 0 ? (
        interviews.map((interview) => (
          <div key={interview._id || interview.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{interview.candidateName}</h3>
                <p className="text-sm text-gray-600">{new Date(interview.scheduledDate).toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Status: {interview.status}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onJoin(interview.meetingLink)}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                >
                  <Video className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onEdit(interview)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => onCancel(interview._id || interview.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-12">
          <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No interviews scheduled</h3>
          <p className="text-gray-500">Schedule interviews with candidates</p>
        </div>
      )}
    </div>
  </div>
);

const MessageCenter = ({ messages = [], user = {}, onSend, onMarkAsRead, onDelete }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-2xl font-bold text-gray-900">Message Center</h2>
    </div>
    <div className="space-y-4">
      {messages && messages.length > 0 ? (
        messages.map((message) => (
          <div key={message._id || message.id} className={`p-4 border rounded-lg transition-colors ${!message.read ? 'bg-blue-50 border-blue-200' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{message.fromUserId?.name || message.senderName}</p>
                    <p className="text-xs text-gray-500">{new Date(message.sentAt).toLocaleString()}</p>
                  </div>
                </div>
                <p className="text-gray-700">{message.body}</p>
              </div>
              <div className="flex items-center space-x-2">
                {!message.read && (
                  <button
                    onClick={() => onMarkAsRead(message._id || message.id)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => onDelete(message._id || message.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-12">
          <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No messages</h3>
          <p className="text-gray-500">Messages from candidates will appear here</p>
        </div>
      )}
    </div>
  </div>
);

const Analytics = ({ stats = {}, applicants = [], jobs = [], exams = [], payments = [], dateRange, onDateRangeChange, onExport }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
        <p className="text-sm text-gray-500 mt-1">Track your recruitment metrics</p>
      </div>
      <div className="flex items-center space-x-3">
        <select
          value={dateRange}
          onChange={(e) => onDateRangeChange(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
        <button
          onClick={onExport}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
        >
          <Download className="w-4 h-4 mr-2" />
          Export
        </button>
      </div>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl">
        <p className="text-sm text-blue-600 mb-2">Total Applicants</p>
        <p className="text-3xl font-bold text-blue-900">{stats.totalApplicants || 0}</p>
      </div>
      <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl">
        <p className="text-sm text-green-600 mb-2">Conversion Rate</p>
        <p className="text-3xl font-bold text-green-900">{stats.conversionRate || 0}%</p>
      </div>
      <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl">
        <p className="text-sm text-purple-600 mb-2">Total Jobs</p>
        <p className="text-3xl font-bold text-purple-900">{stats.totalJobs || 0}</p>
      </div>
      <div className="p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl">
        <p className="text-sm text-orange-600 mb-2">Total Spent</p>
        <p className="text-3xl font-bold text-orange-900">${stats.totalSpent || 0}</p>
      </div>
    </div>
  </div>
);

const PaymentHistory = ({ payments = [], advertisements = [], onViewInvoice, onDownloadReceipt }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Payment History</h2>
        <p className="text-sm text-gray-500 mt-1">Track your billing and payments</p>
      </div>
    </div>
    <div className="space-y-4">
      {payments && payments.length > 0 ? (
        payments.map((payment) => (
          <div key={payment._id || payment.id} className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{payment.description || 'Payment'}</p>
                <p className="text-sm text-gray-600">${payment.amount} - {new Date(payment.date).toLocaleDateString()}</p>
                <p className="text-xs text-gray-500">Status: {payment.status}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onViewInvoice(payment)}
                  className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  View Invoice
                </button>
                <button
                  onClick={() => onDownloadReceipt(payment)}
                  className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Receipt
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-12">
          <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No payment history</h3>
          <p className="text-gray-500">Your payment transactions will appear here</p>
        </div>
      )}
    </div>
  </div>
);

const Settings = ({ profile = {}, darkMode, onDarkModeChange, onUpdateProfile, onLogout }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
    </div>
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <h3 className="font-semibold text-gray-900">Dark Mode</h3>
          <p className="text-sm text-gray-600">Switch between light and dark theme</p>
        </div>
        <button
          onClick={() => onDarkModeChange(!darkMode)}
          className={`px-4 py-2 rounded-lg transition-colors ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-900'}`}
        >
          {darkMode ? 'On' : 'Off'}
        </button>
      </div>
      
      <button
        onClick={onLogout}
        className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
      >
        Logout
      </button>
    </div>
  </div>
);

const Modal = ({ type, data, onClose, onSubmit, jobs, applicants, packages, uploadFile }) => {
  const [formData, setFormData] = useState(data || {});

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const getModalTitle = () => {
    switch (type) {
      case 'job': return data ? 'Edit Job' : 'Create New Job';
      case 'exam': return data ? 'Edit Exam' : 'Create New Exam';
      case 'activity': return data ? 'Edit Activity' : 'Create New Activity';
      case 'ad': return data ? 'Edit Advertisement' : 'Create New Advertisement';
      case 'interview': return data ? 'Edit Interview' : 'Schedule Interview';
      case 'message': return 'Send Message';
      default: return 'Modal';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">{getModalTitle()}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'job' && (
            <>
              <input
                type="text"
                placeholder="Job Title"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Company"
                value={formData.company || ''}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Location"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <textarea
                placeholder="Description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="4"
                required
              />
            </>
          )}
          
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {data ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CompanyDashboard = ({ user, onLogout, showNotification }) => {
  // ==================== STATE MANAGEMENT ====================
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  // Data states
  const [companyProfile, setCompanyProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [exams, setExams] = useState([]);
  const [activities, setActivities] = useState([]);
  const [advertisements, setAdvertisements] = useState([]);
  const [talentPool, setTalentPool] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [messages, setMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [payments, setPayments] = useState([]);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [toast, setToast] = useState(null);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30d');
  const [selectedJob, setSelectedJob] = useState(null);

  // ==================== DARK MODE TOGGLE ====================
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // ==================== TOAST NOTIFICATION ====================
  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 3000);
    if (showNotification) {
      showNotification(message, type);
    }
  };

  // ==================== API HELPER ====================
  const makeApiCall = useCallback(async (endpoint, options = {}) => {
    try {
      setIsLoading(true);
      const data = await apiRequest(endpoint, options);
      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      if (error.status !== 404) {
        showToast(error.message || 'Request failed', 'error');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ==================== INITIAL DATA LOAD ====================
  useEffect(() => {
    loadDashboardData();
    
    const interval = setInterval(() => {
      refreshData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      await Promise.allSettled([
        fetchCompanyProfile(),
        fetchJobs(),
        fetchApplicants(),
        fetchExams(),
        fetchActivities(),
        fetchAdvertisements(),
        fetchTalentPool(),
        fetchInterviews(),
        fetchMessages(),
        fetchNotifications(),
        fetchPayments()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const refreshData = async () => {
    try {
      await Promise.allSettled([
        fetchNotifications(),
        fetchUnreadCount()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  // ==================== DATA FETCH FUNCTIONS ====================
  const fetchCompanyProfile = async () => {
    try {
      const data = await apiRequest('/company/profile');
      if (data && data.success === false && data.status === 404) {
        const defaultProfile = {
          companyName: user?.name || 'My Company',
          companyEmail: user?.email || '',
          companyPhone: '',
          website: '',
          industry: 'technology',
          companySize: '1-10',
          description: '',
          logo: null,
          socialMedia: {}
        };
        setCompanyProfile(defaultProfile);
        return;
      }
      setCompanyProfile(data?.profile || data?.company || null);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setCompanyProfile({
        companyName: user?.name || 'My Company',
        companyEmail: user?.email || '',
        industry: 'technology',
        companySize: '1-10'
      });
    }
  };

  const fetchJobs = async () => {
    try {
      const data = await apiRequest('/jobs/company');
      if (data && data.success === false && data.status === 404) {
        setJobs([]);
        return;
      }
      setJobs(data?.jobs || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
    }
  };

  const fetchApplicants = async () => {
    try {
      const data = await apiRequest('/applications/company');
      if (data && data.success === false && data.status === 404) {
        setApplicants([]);
        return;
      }
      setApplicants(data?.applications || []);
    } catch (error) {
      console.error('Error fetching applicants:', error);
      setApplicants([]);
    }
  };

  const fetchExams = async () => {
    try {
      const data = await apiRequest('/exams/company');
      if (data && data.success === false && data.status === 404) {
        setExams([]);
        return;
      }
      setExams(data?.exams || []);
    } catch (error) {
      console.error('Error fetching exams:', error);
      setExams([]);
    }
  };

  const fetchActivities = async () => {
    try {
      const data = await apiRequest('/activities/company');
      if (data && data.success === false && data.status === 404) {
        setActivities([
          { 
            id: '1', 
            type: 'info', 
            title: 'Welcome to Company Dashboard', 
            message: 'Your company dashboard is ready. Start by posting your first job.',
            timestamp: new Date(),
            read: false
          },
          {
            id: '2',
            type: 'success',
            title: 'Profile Setup',
            message: 'Complete your company profile to attract more candidates.',
            timestamp: new Date(Date.now() - 3600000),
            read: false
          }
        ]);
        return;
      }
      setActivities(data?.activities || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      setActivities([]);
    }
  };

  const fetchAdvertisements = async () => {
    try {
      const data = await apiRequest('/advertisements/company');
      if (data && data.success === false && data.status === 404) {
        setAdvertisements([]);
        return;
      }
      setAdvertisements(data?.advertisements || []);
    } catch (error) {
      console.error('Error fetching advertisements:', error);
      setAdvertisements([]);
    }
  };

  const fetchTalentPool = async () => {
    try {
      const data = await apiRequest('/talent-pool/company');
      if (data && data.success === false && data.status === 404) {
        setTalentPool([]);
        return;
      }
      setTalentPool(data?.talentPool || []);
    } catch (error) {
      console.error('Error fetching talent pool:', error);
      setTalentPool([]);
    }
  };

  const fetchInterviews = async () => {
    try {
      const data = await apiRequest('/interviews/company');
      if (data && data.success === false && data.status === 404) {
        setInterviews([]);
        return;
      }
      setInterviews(data?.interviews || []);
    } catch (error) {
      console.error('Error fetching interviews:', error);
      setInterviews([]);
    }
  };

  const fetchMessages = async () => {
    try {
      const data = await apiRequest('/messages');
      if (data && data.success === false && data.status === 404) {
        setMessages([]);
        return;
      }
      setMessages(data?.inbox || data?.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    }
  };

  const fetchNotifications = async () => {
    try {
      const data = await apiRequest('/notifications');
      if (data && data.success === false && data.status === 404) {
        setNotifications([
          {
            id: '1',
            title: 'Welcome!',
            message: 'Welcome to your company dashboard. We\'re here to help you find the best talent.',
            type: 'info',
            read: false,
            createdAt: new Date()
          },
          {
            id: '2',
            title: 'Complete Your Profile',
            message: 'Complete your company profile to attract more qualified candidates.',
            type: 'warning',
            read: false,
            createdAt: new Date(Date.now() - 86400000)
          }
        ]);
        return;
      }
      setNotifications(data?.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    }
  };

  const fetchPayments = async () => {
    try {
      const data = await apiRequest('/payments/company');
      if (data && data.success === false && data.status === 404) {
        setPayments([]);
        return;
      }
      setPayments(data?.payments || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      setPayments([]);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const data = await apiRequest('/messages/unread-count');
      if (data && data.success === false && data.status === 404) {
        setUnreadCount(0);
        return;
      }
      setUnreadCount(data?.unreadCount || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setUnreadCount(0);
    }
  };

  // ==================== CRUD OPERATIONS ====================
  const createJob = async (jobData) => {
    try {
      const data = await makeApiCall('/jobs', {
        method: 'POST',
        body: JSON.stringify(jobData)
      });
      setJobs(prev => [data.job, ...prev]);
      showToast('Job created successfully', 'success');
      return data.job;
    } catch (error) {
      console.error('Error creating job:', error);
      throw error;
    }
  };

  const updateJob = async (jobId, jobData) => {
    try {
      const data = await makeApiCall(`/jobs/${jobId}`, {
        method: 'PUT',
        body: JSON.stringify(jobData)
      });
      setJobs(prev => prev.map(j => (j._id === jobId || j.id === jobId) ? data.job : j));
      showToast('Job updated successfully', 'success');
      return data.job;
    } catch (error) {
      console.error('Error updating job:', error);
      throw error;
    }
  };

  const deleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job?')) return;
    
    try {
      await makeApiCall(`/jobs/${jobId}`, { method: 'DELETE' });
      setJobs(prev => prev.filter(j => j._id !== jobId && j.id !== jobId));
      showToast('Job deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting job:', error);
      throw error;
    }
  };

  const updateApplicationStatus = async (applicationId, status, notes = '') => {
    try {
      const data = await makeApiCall(`/applications/${applicationId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, notes })
      });
      
      setApplicants(prev => prev.map(a => 
        (a._id === applicationId || a.id === applicationId) ? { ...a, status, notes } : a
      ));
      
      showToast(`Application ${status}`, 'success');
      
      return data.application;
    } catch (error) {
      console.error('Error updating status:', error);
      throw error;
    }
  };

  const createExam = async (examData) => {
    try {
      const data = await makeApiCall('/exams', {
        method: 'POST',
        body: JSON.stringify(examData)
      });
      setExams(prev => [data.exam, ...prev]);
      showToast('Exam created successfully', 'success');
      return data.exam;
    } catch (error) {
      console.error('Error creating exam:', error);
      throw error;
    }
  };

  const updateExam = async (examId, examData) => {
    try {
      const data = await makeApiCall(`/exams/${examId}`, {
        method: 'PUT',
        body: JSON.stringify(examData)
      });
      setExams(prev => prev.map(e => (e._id === examId || e.id === examId) ? data.exam : e));
      showToast('Exam updated successfully', 'success');
      return data.exam;
    } catch (error) {
      console.error('Error updating exam:', error);
      throw error;
    }
  };

  const deleteExam = async (examId) => {
    if (!window.confirm('Are you sure you want to delete this exam?')) return;
    
    try {
      await makeApiCall(`/exams/${examId}`, { method: 'DELETE' });
      setExams(prev => prev.filter(e => e._id !== examId && e.id !== examId));
      showToast('Exam deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting exam:', error);
      throw error;
    }
  };

  const createActivity = async (activityData) => {
    try {
      const data = await makeApiCall('/activities', {
        method: 'POST',
        body: JSON.stringify(activityData)
      });
      setActivities(prev => [data.activity, ...prev]);
      showToast('Activity created successfully', 'success');
      return data.activity;
    } catch (error) {
      console.error('Error creating activity:', error);
      throw error;
    }
  };

  const updateActivity = async (activityId, activityData) => {
    try {
      const data = await makeApiCall(`/activities/${activityId}`, {
        method: 'PUT',
        body: JSON.stringify(activityData)
      });
      setActivities(prev => prev.map(a => (a._id === activityId || a.id === activityId) ? data.activity : a));
      showToast('Activity updated successfully', 'success');
      return data.activity;
    } catch (error) {
      console.error('Error updating activity:', error);
      throw error;
    }
  };

  const deleteActivity = async (activityId) => {
    if (!window.confirm('Are you sure you want to delete this activity?')) return;
    
    try {
      await makeApiCall(`/activities/${activityId}`, { method: 'DELETE' });
      setActivities(prev => prev.filter(a => a._id !== activityId && a.id !== activityId));
      showToast('Activity deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting activity:', error);
      throw error;
    }
  };

  const createAdvertisement = async (adData) => {
    try {
      const data = await makeApiCall('/advertisements', {
        method: 'POST',
        body: JSON.stringify({
          ...adData,
          status: 'active',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + (adData.duration || 30) * 24 * 60 * 60 * 1000).toISOString()
        })
      });
      
      setAdvertisements(prev => [data.ad, ...prev]);
      showToast('Advertisement created successfully', 'success');
      
      return data.ad;
    } catch (error) {
      console.error('Error creating advertisement:', error);
      throw error;
    }
  };

  const updateAdvertisement = async (adId, adData) => {
    try {
      const data = await makeApiCall(`/advertisements/${adId}`, {
        method: 'PUT',
        body: JSON.stringify(adData)
      });
      setAdvertisements(prev => prev.map(a => (a._id === adId || a.id === adId) ? data.ad : a));
      showToast('Advertisement updated successfully', 'success');
      return data.ad;
    } catch (error) {
      console.error('Error updating advertisement:', error);
      throw error;
    }
  };

  const deleteAdvertisement = async (adId) => {
    if (!window.confirm('Are you sure you want to delete this advertisement?')) return;
    
    try {
      await makeApiCall(`/advertisements/${adId}`, { method: 'DELETE' });
      setAdvertisements(prev => prev.filter(a => a._id !== adId && a.id !== adId));
      showToast('Advertisement deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting advertisement:', error);
      throw error;
    }
  };

  const addToTalentPool = async (applicantId, notes = '') => {
    try {
      const data = await makeApiCall('/talent-pool', {
        method: 'POST',
        body: JSON.stringify({ applicantId, notes })
      });
      setTalentPool(prev => [data.candidate, ...prev]);
      showToast('Candidate added to talent pool', 'success');
      return data.candidate;
    } catch (error) {
      console.error('Error adding to talent pool:', error);
      throw error;
    }
  };

  const removeFromTalentPool = async (candidateId) => {
    if (!window.confirm('Remove this candidate from talent pool?')) return;
    
    try {
      await makeApiCall(`/talent-pool/${candidateId}`, { method: 'DELETE' });
      setTalentPool(prev => prev.filter(c => c._id !== candidateId && c.id !== candidateId));
      showToast('Candidate removed from talent pool', 'success');
    } catch (error) {
      console.error('Error removing from talent pool:', error);
      throw error;
    }
  };

  const scheduleInterview = async (interviewData) => {
    try {
      const data = await makeApiCall('/interviews', {
        method: 'POST',
        body: JSON.stringify(interviewData)
      });
      setInterviews(prev => [data.interview, ...prev]);
      showToast('Interview scheduled successfully', 'success');
      
      return data.interview;
    } catch (error) {
      console.error('Error scheduling interview:', error);
      throw error;
    }
  };

  const updateInterview = async (interviewId, interviewData) => {
    try {
      const data = await makeApiCall(`/interviews/${interviewId}`, {
        method: 'PUT',
        body: JSON.stringify(interviewData)
      });
      setInterviews(prev => prev.map(i => (i._id === interviewId || i.id === interviewId) ? data.interview : i));
      showToast('Interview updated successfully', 'success');
      return data.interview;
    } catch (error) {
      console.error('Error updating interview:', error);
      throw error;
    }
  };

  const cancelInterview = async (interviewId) => {
    if (!window.confirm('Cancel this interview?')) return;
    
    try {
      await makeApiCall(`/interviews/${interviewId}`, { method: 'DELETE' });
      setInterviews(prev => prev.filter(i => i._id !== interviewId && i.id !== interviewId));
      showToast('Interview cancelled', 'success');
    } catch (error) {
      console.error('Error cancelling interview:', error);
      throw error;
    }
  };

  const sendMessage = async (recipientId, subject, body) => {
    try {
      const data = await makeApiCall('/messages', {
        method: 'POST',
        body: JSON.stringify({ toUserId: recipientId, subject, body })
      });
      setMessages(prev => [data.message, ...prev]);
      showToast('Message sent', 'success');
      return data.message;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  const markAsRead = async (messageId) => {
    try {
      await makeApiCall(`/messages/${messageId}/read`, { method: 'PUT' });
      setMessages(prev => prev.map(m => 
        (m._id === messageId || m.id === messageId) ? { ...m, read: true } : m
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    try {
      await makeApiCall(`/notifications/${notificationId}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => 
        (n._id === notificationId || n.id === notificationId) ? { ...n, read: true } : n
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // ==================== FILE UPLOAD ====================
  const uploadFile = async (file, type = 'image') => {
    const formData = new FormData();
    formData.append(type === 'image' ? 'image' : 'file', file);
    
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/upload${type === 'logo' ? '/logo' : type === 'resume' ? '/resume' : ''}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Upload failed');
      
      showToast('File uploaded successfully', 'success');
      return data.imageUrl || data.logoUrl || data.resume?.url;
    } catch (error) {
      console.error('Error uploading file:', error);
      showToast('File upload failed', 'error');
      throw error;
    }
  };

  // ==================== EXPORT FUNCTIONS ====================
  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) {
      showToast('No data to export', 'error');
      return;
    }
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => JSON.stringify(row[h] || '')).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('Export completed', 'success');
  };

  // ==================== FILTERED DATA ====================
  const filteredApplicants = useMemo(() => {
    return applicants.filter(applicant => {
      const matchesSearch = searchTerm === '' || 
        applicant.applicantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        applicant.applicantEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (applicant.skills && applicant.skills.some(s => s?.toLowerCase().includes(searchTerm.toLowerCase())));
      
      const matchesStatus = statusFilter === 'all' || applicant.status === statusFilter;
      const matchesJob = !selectedJob || applicant.jobId === (selectedJob._id || selectedJob.id);
      
      return matchesSearch && matchesStatus && matchesJob;
    });
  }, [applicants, searchTerm, statusFilter, selectedJob]);

  // ==================== STATISTICS ====================
  const stats = useMemo(() => ({
    totalJobs: jobs.length,
    activeJobs: jobs.filter(j => j.status === 'active' || j.status === 'published').length,
    totalApplicants: applicants.length,
    pendingApplicants: applicants.filter(a => a.status === 'pending').length,
    approvedApplicants: applicants.filter(a => a.status === 'approved').length,
    rejectedApplicants: applicants.filter(a => a.status === 'rejected').length,
    interviewedApplicants: applicants.filter(a => a.status === 'interviewed').length,
    hiredApplicants: applicants.filter(a => a.status === 'hired').length,
    conversionRate: applicants.length ? 
      Math.round((applicants.filter(a => a.status === 'hired').length / applicants.length) * 100) : 0,
    upcomingExams: exams.filter(e => new Date(e.date) > new Date()).length,
    totalActivities: activities.length,
    talentPoolCount: talentPool.length,
    upcomingInterviews: interviews.filter(i => new Date(i.scheduledDate || i.date) > new Date()).length,
    activeAds: advertisements.filter(a => a.status === 'active').length,
    totalSpent: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
    unreadMessages: unreadCount,
    unreadNotifications: notifications.filter(n => !n.read).length
  }), [jobs, applicants, exams, activities, talentPool, interviews, advertisements, payments, unreadCount, notifications]);

  // ==================== NAVIGATION ITEMS ====================
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, count: null, color: 'from-blue-500 to-blue-600' },
    { id: 'profile', label: 'Company Profile', icon: Building, count: null, color: 'from-purple-500 to-purple-600' },
    { id: 'jobs', label: 'Job Posts', icon: Briefcase, count: stats.activeJobs, color: 'from-green-500 to-green-600' },
    { id: 'applicants', label: 'Applicants', icon: Users, count: stats.pendingApplicants, color: 'from-orange-500 to-orange-600' },
    { id: 'exams', label: 'Exams', icon: FileCode, count: stats.upcomingExams, color: 'from-red-500 to-red-600' },
    { id: 'activities', label: 'Activities', icon: Calendar, count: stats.totalActivities, color: 'from-yellow-500 to-yellow-600' },
    { id: 'advertise', label: 'Advertise', icon: CreditCard, count: stats.activeAds, color: 'from-pink-500 to-pink-600' },
    { id: 'talentPool', label: 'Talent Pool', icon: Users2, count: stats.talentPoolCount, color: 'from-indigo-500 to-indigo-600' },
    { id: 'interviews', label: 'Interviews', icon: Video, count: stats.upcomingInterviews, color: 'from-teal-500 to-teal-600' },
    { id: 'messages', label: 'Messages', icon: MessageSquare, count: stats.unreadMessages, color: 'from-cyan-500 to-cyan-600' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, count: null, color: 'from-violet-500 to-violet-600' },
    { id: 'payments', label: 'Payments', icon: CreditCard, count: payments.length, color: 'from-amber-500 to-amber-600' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, count: null, color: 'from-gray-500 to-gray-600' }
  ];

  // ==================== RENDER ====================
  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-100 dark:border-gray-700 border-t-blue-600"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Building className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mt-4 font-medium">Loading your dashboard...</p>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-2xl border animate-slideIn backdrop-blur-md ${
          toast.type === 'success' ? 'bg-green-50 dark:bg-green-900/90 border-green-200 dark:border-green-700 text-green-800 dark:text-green-100' :
          toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/90 border-red-200 dark:border-red-700 text-red-800 dark:text-red-100' :
          'bg-blue-50 dark:bg-blue-900/90 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-100'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`p-1.5 rounded-full ${
              toast.type === 'success' ? 'bg-green-200 dark:bg-green-800' :
              toast.type === 'error' ? 'bg-red-200 dark:bg-red-800' :
              'bg-blue-200 dark:bg-blue-800'
            }`}>
              {toast.type === 'success' ? <CheckCircle className="h-5 w-5" /> :
               toast.type === 'error' ? <AlertCircle className="h-5 w-5" /> :
               <Info className="h-5 w-5" />}
            </div>
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
      >
        <Menu className="h-6 w-6 text-gray-700 dark:text-gray-300" />
      </button>

      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                    <Building className="h-6 w-6 text-white" />
                  </div>
                  <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    CompanyHub
                  </span>
                </div>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>
            <nav className="p-4">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3.5 rounded-xl mb-1.5 transition-all ${
                    activeTab === item.id
                      ? `bg-gradient-to-r ${item.color} text-white shadow-lg`
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  {item.count > 0 && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      activeTab === item.id
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}>
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className={`hidden lg:block fixed left-0 top-0 bottom-0 transition-all duration-300 ${
        sidebarCollapsed ? 'w-20' : 'w-72'
      } bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shadow-xl z-40`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} p-6 border-b border-gray-100 dark:border-gray-800`}>
            {!sidebarCollapsed && (
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                  <Building className="h-6 w-6 text-white" />
                </div>
                <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  CompanyHub
                </span>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                <Building className="h-6 w-6 text-white" />
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {sidebarCollapsed ? 
                <ChevronRight className="h-4 w-4 text-gray-500" /> : 
                <ChevronLeft className="h-4 w-4 text-gray-500" />
              }
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-6 px-3">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-4 py-3.5 rounded-xl mb-1.5 transition-all ${
                  activeTab === item.id
                    ? `bg-gradient-to-r ${item.color} text-white shadow-lg`
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                } ${sidebarCollapsed ? 'justify-center' : ''}`}
                title={sidebarCollapsed ? item.label : ''}
              >
                <item.icon className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left font-medium">{item.label}</span>
                    {item.count > 0 && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        activeTab === item.id
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}>
                        {item.count}
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800">
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'}`}>
              <div className="relative group">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  {companyProfile?.logo ? (
                    <img 
                      src={companyProfile.logo} 
                      alt="Company" 
                      className="w-full h-full rounded-xl object-cover" 
                    />
                  ) : (
                    <User className="h-6 w-6 text-white" />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full ring-2 ring-white dark:ring-gray-900 animate-pulse"></div>
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {companyProfile?.companyName || user?.name || 'Company Name'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user?.email || 'company@example.com'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'}`}>
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  {navItems.find(item => item.id === activeTab)?.label}
                </h1>
                {activeTab === 'applicants' && stats.pendingApplicants > 0 && (
                  <span className="px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full text-xs font-medium flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {stats.pendingApplicants} pending
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-3">
                {/* Quick Search */}
                <button
                  onClick={() => setShowSearchModal(true)}
                  className="hidden md:flex items-center px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Quick search...
                  <span className="ml-4 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">⌘K</span>
                </button>

                {/* Quick Actions */}
                <div className="relative">
                  <button
                    onClick={() => setShowQuickActions(!showQuickActions)}
                    className="p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Zap className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </button>

                  {showQuickActions && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                      <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                        <h3 className="font-medium text-gray-900 dark:text-white">Quick Actions</h3>
                      </div>
                      <div className="p-2">
                        <button
                          onClick={() => {
                            setModalType('job');
                            setShowModal(true);
                            setShowQuickActions(false);
                          }}
                          className="w-full flex items-center px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <Plus className="h-4 w-4 mr-3 text-green-600" />
                          Post New Job
                        </button>
                        <button
                          onClick={() => {
                            setModalType('exam');
                            setShowModal(true);
                            setShowQuickActions(false);
                          }}
                          className="w-full flex items-center px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <FileCode className="h-4 w-4 mr-3 text-blue-600" />
                          Create Exam
                        </button>
                        <button
                          onClick={() => {
                            setModalType('activity');
                            setShowModal(true);
                            setShowQuickActions(false);
                          }}
                          className="w-full flex items-center px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <Calendar className="h-4 w-4 mr-3 text-purple-600" />
                          Schedule Activity
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Dark Mode Toggle */}
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {darkMode ? <Sun className="h-5 w-5 text-yellow-500" /> : <Moon className="h-5 w-5 text-gray-600" />}
                </button>

                {/* Notifications */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    {stats.unreadNotifications > 0 && (
                      <>
                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900"></span>
                      </>
                    )}
                  </button>

                  {/* Notifications Dropdown */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                          <button 
                            onClick={() => {
                              notifications.forEach(n => {
                                if (!n.read) markNotificationAsRead(n._id || n.id);
                              });
                              setShowNotifications(false);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700"
                          >
                            Mark all as read
                          </button>
                        </div>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length > 0 ? (
                          notifications.slice(0, 5).map(notification => (
                            <div
                              key={notification._id || notification.id}
                              onClick={() => {
                                markNotificationAsRead(notification._id || notification.id);
                                setShowNotifications(false);
                              }}
                              className={`p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                                !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                              }`}
                            >
                              <div className="flex items-start space-x-3">
                                <div className={`p-2 rounded-lg ${
                                  notification.type === 'success' ? 'bg-green-100 dark:bg-green-900' :
                                  notification.type === 'error' ? 'bg-red-100 dark:bg-red-900' :
                                  notification.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900' :
                                  'bg-blue-100 dark:bg-blue-900'
                                }`}>
                                  {notification.type === 'success' ? <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" /> :
                                   notification.type === 'error' ? <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" /> :
                                   notification.type === 'warning' ? <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" /> :
                                   <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-gray-900 dark:text-white font-medium">{notification.title}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{notification.message}</p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                    {new Date(notification.createdAt || notification.date || notification.timestamp).toLocaleString()}
                                  </p>
                                </div>
                                {!notification.read && (
                                  <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center">
                            <Bell className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">No notifications</p>
                          </div>
                        )}
                      </div>
                      <div className="p-3 text-center border-t border-gray-100 dark:border-gray-700">
                        <button className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium">
                          View All Notifications
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* New Job Button */}
                <button
                  onClick={() => {
                    setModalType('job');
                    setShowModal(true);
                  }}
                  className="flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Job
                </button>

                {/* Logout */}
                <button
                  onClick={onLogout}
                  className="p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <LogOut className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {activeTab === 'dashboard' && (
            <DashboardOverview
              stats={stats}
              applicants={applicants.slice(0, 5)}
              jobs={jobs.slice(0, 3)}
              onViewAll={() => setActiveTab('applicants')}
              onViewItem={setSelectedItem}
              onNewJob={() => {
                setModalType('job');
                setShowModal(true);
              }}
            />
          )}

          {activeTab === 'profile' && (
            <CompanyProfile
              profile={companyProfile}
              onEdit={() => {
                setModalType('profile');
                setShowModal(true);
              }}
              onUpdate={fetchCompanyProfile}
              uploadFile={uploadFile}
            />
          )}

          {activeTab === 'jobs' && (
            <JobManagement
              jobs={jobs}
              onCreate={() => {
                setModalType('job');
                setShowModal(true);
              }}
              onEdit={(job) => {
                setSelectedItem(job);
                setModalType('job');
                setShowModal(true);
              }}
              onDelete={deleteJob}
            />
          )}

          {activeTab === 'applicants' && (
            <ApplicantManagement
              applicants={filteredApplicants}
              jobs={jobs}
              searchTerm={searchTerm}
              statusFilter={statusFilter}
              selectedJob={selectedJob}
              onSearchChange={setSearchTerm}
              onStatusFilterChange={setStatusFilter}
              onJobFilterChange={setSelectedJob}
              onUpdateStatus={updateApplicationStatus}
              onMessage={(applicant) => {
                setSelectedItem(applicant);
                setModalType('message');
                setShowModal(true);
              }}
              onAddToTalentPool={addToTalentPool}
              onScheduleInterview={(applicant) => {
                setSelectedItem(applicant);
                setModalType('interview');
                setShowModal(true);
              }}
              onExport={() => exportToCSV(applicants, 'applicants')}
            />
          )}

          {activeTab === 'exams' && (
            <ExamManagement
              exams={exams}
              jobs={jobs}
              applicants={applicants}
              onCreate={() => {
                setModalType('exam');
                setShowModal(true);
              }}
              onEdit={(exam) => {
                setSelectedItem(exam);
                setModalType('exam');
                setShowModal(true);
              }}
              onDelete={deleteExam}
            />
          )}

          {activeTab === 'activities' && (
            <ActivityManagement
              activities={activities}
              onCreate={() => {
                setModalType('activity');
                setShowModal(true);
              }}
              onEdit={(activity) => {
                setSelectedItem(activity);
                setModalType('activity');
                setShowModal(true);
              }}
              onDelete={deleteActivity}
            />
          )}

          {activeTab === 'advertise' && (
            <AdManagement
              advertisements={advertisements}
              packages={[
                { id: 'basic', name: 'Basic', duration: 7, price: 50, impressions: 1000 },
                { id: 'premium', name: 'Premium', duration: 30, price: 150, impressions: 5000 },
                { id: 'enterprise', name: 'Enterprise', duration: 90, price: 400, impressions: 20000 }
              ]}
              onCreate={() => {
                setModalType('ad');
                setShowModal(true);
              }}
              onEdit={(ad) => {
                setSelectedItem(ad);
                setModalType('ad');
                setShowModal(true);
              }}
              onDelete={deleteAdvertisement}
            />
          )}

          {activeTab === 'talentPool' && (
            <TalentPool
              candidates={talentPool}
              onRemove={removeFromTalentPool}
              onContact={(candidate) => {
                setSelectedItem(candidate);
                setModalType('message');
                setShowModal(true);
              }}
              onScheduleInterview={(candidate) => {
                setSelectedItem(candidate);
                setModalType('interview');
                setShowModal(true);
              }}
            />
          )}

          {activeTab === 'interviews' && (
            <InterviewManagement
              interviews={interviews}
              applicants={applicants}
              onCreate={() => {
                setModalType('interview');
                setShowModal(true);
              }}
              onEdit={(interview) => {
                setSelectedItem(interview);
                setModalType('interview');
                setShowModal(true);
              }}
              onCancel={cancelInterview}
              onJoin={(meetingLink) => window.open(meetingLink, '_blank')}
            />
          )}

          {activeTab === 'messages' && (
            <MessageCenter
              messages={messages}
              user={user}
              onSend={sendMessage}
              onMarkAsRead={markAsRead}
              onDelete={async (messageId) => {
                try {
                  await makeApiCall(`/messages/${messageId}`, { method: 'DELETE' });
                  setMessages(prev => prev.filter(m => m._id !== messageId && m.id !== messageId));
                  showToast('Message deleted', 'success');
                } catch (error) {
                  console.error('Error deleting message:', error);
                }
              }}
            />
          )}

          {activeTab === 'analytics' && (
            <Analytics
              stats={stats}
              applicants={applicants}
              jobs={jobs}
              exams={exams}
              payments={payments}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              onExport={() => exportToCSV([
                { ...stats, date: new Date().toISOString() }
              ], 'analytics')}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentHistory
              payments={payments}
              advertisements={advertisements}
              onViewInvoice={(payment) => window.open(`/invoices/${payment._id || payment.id}`, '_blank')}
              onDownloadReceipt={(payment) => {
                showToast('Receipt downloaded', 'success');
              }}
            />
          )}

          {activeTab === 'settings' && (
            <Settings
              profile={companyProfile}
              darkMode={darkMode}
              onDarkModeChange={setDarkMode}
              onUpdateProfile={fetchCompanyProfile}
              onLogout={onLogout}
            />
          )}
        </main>
      </div>

      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSearchModal(false)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center">
                <Search className="h-5 w-5 text-gray-400 mr-3" />
                <input
                  type="text"
                  placeholder="Search jobs, applicants, messages..."
                  className="flex-1 outline-none text-gray-900 dark:text-white bg-transparent"
                  autoFocus
                />
                <button
                  onClick={() => setShowSearchModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-2 max-h-96 overflow-y-auto">
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                Type to search...
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <Modal
          type={modalType}
          data={selectedItem}
          onClose={() => {
            setShowModal(false);
            setSelectedItem(null);
            setModalType(null);
          }}
          onSubmit={async (data) => {
            try {
              switch (modalType) {
                case 'job':
                  if (selectedItem) {
                    await updateJob(selectedItem._id || selectedItem.id, data);
                  } else {
                    await createJob(data);
                  }
                  break;
                case 'exam':
                  if (selectedItem) {
                    await updateExam(selectedItem._id || selectedItem.id, data);
                  } else {
                    await createExam(data);
                  }
                  break;
                case 'activity':
                  if (selectedItem) {
                    await updateActivity(selectedItem._id || selectedItem.id, data);
                  } else {
                    await createActivity(data);
                  }
                  break;
                case 'ad':
                  if (selectedItem) {
                    await updateAdvertisement(selectedItem._id || selectedItem.id, data);
                  } else {
                    await createAdvertisement(data);
                  }
                  break;
                case 'interview':
                  if (selectedItem) {
                    await updateInterview(selectedItem._id || selectedItem.id, data);
                  } else {
                    await scheduleInterview(data);
                  }
                  break;
                case 'message':
                  await sendMessage(data.recipientId, data.subject, data.body);
                  break;
                default:
                  break;
              }
              setShowModal(false);
              setSelectedItem(null);
              setModalType(null);
            } catch (error) {
              console.error('Error submitting:', error);
            }
          }}
          jobs={jobs}
          applicants={applicants}
          packages={[
            { id: 'basic', name: 'Basic', duration: 7, price: 50, impressions: 1000 },
            { id: 'premium', name: 'Premium', duration: 30, price: 150, impressions: 5000 },
            { id: 'enterprise', name: 'Enterprise', duration: 90, price: 400, impressions: 20000 }
          ]}
          uploadFile={uploadFile}
        />
      )}
    </div>
  );
};

export default CompanyDashboard;