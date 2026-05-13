'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { Project, Agenda, Point } from '@/app/lib/interface';
import { useAuth } from './userContext';
import { sanitizeObject } from '@/app/lib/utilts';

interface ProjectsContextType {
  projects: Project[];
  loading: boolean;
  addProject: (project: Omit<Project, 'id' | 'createdAt'>) => Promise<string>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addAgenda: (projectId: string, agenda: Omit<Agenda, 'id'>) => Promise<void>;
  updateAgenda: (projectId: string, agendaId: string, updates: Partial<Agenda>) => Promise<void>;
  deleteAgenda: (projectId: string, agendaId: string) => Promise<void>;
  addPoint: (projectId: string, agendaId: string, point: Omit<Point, 'id'>) => Promise<void>;
  updatePoint: (projectId: string, agendaId: string, pointId: string, updates: Partial<Point>) => Promise<void>;
  deletePoint: (projectId: string, agendaId: string, pointId: string) => Promise<void>;
  updateMultiplePoints: (projectId: string, agendaId: string, pointIds: string[], updates: Partial<Point>) => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

export const useProjects = () => {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
};

export const ProjectsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, 'projects'),
        where('userId', '==', user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedProjects: Project[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            ...(data as Project),
            id: doc.id,
            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
            estimatedCompletion: data.estimatedCompletion?.toDate?.() || (data.estimatedCompletion ? new Date(data.estimatedCompletion) : null),
            completedAt: data.completedAt?.toDate?.() || (data.completedAt ? new Date(data.completedAt) : null),
          };
        });

        setProjects(fetchedProjects);
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error fetching projects:', error);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      let unsubscribe: (() => void) | undefined;
      fetchProjects().then(unsub => {
        unsubscribe = unsub;
      });
      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    }
  }, [user, fetchProjects]);

  const addProject = async (projectData: Omit<Project, 'id' | 'createdAt'>) => {
    try {
      const docRef = await addDoc(collection(db, 'projects'), sanitizeObject({
        ...projectData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
      return docRef.id;
    } catch (error) {
      console.error('Error adding project:', error);
      throw error;
    }
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    try {
      const projectRef = doc(db, 'projects', id);
      await updateDoc(projectRef, sanitizeObject({
        ...updates,
        updatedAt: serverTimestamp(),
      }));
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  };

  const deleteProject = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'projects', id));
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  };

  const addAgenda = async (projectId: string, agenda: Omit<Agenda, 'id'>) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newAgenda: Agenda = {
      ...agenda,
      id: Math.random().toString(36).substr(2, 9),
    };

    const updatedAgendas = [...(project.agendas || []), newAgenda];
    await updateProject(projectId, { agendas: updatedAgendas });
  };

  const updateAgenda = async (projectId: string, agendaId: string, updates: Partial<Agenda>) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedAgendas = project.agendas.map(a => 
      a.id === agendaId ? { ...a, ...updates } : a
    );
    await updateProject(projectId, { agendas: updatedAgendas });
  };

  const deleteAgenda = async (projectId: string, agendaId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedAgendas = project.agendas.filter(a => a.id !== agendaId);
    await updateProject(projectId, { agendas: updatedAgendas });
  };

  const addPoint = async (projectId: string, agendaId: string, point: Omit<Point, 'id'>) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newPoint: Point = {
      ...point,
      id: Math.random().toString(36).substr(2, 9),
    };

    const updatedAgendas = project.agendas.map(a => {
      if (a.id === agendaId) {
        return { ...a, points: [...(a.points || []), newPoint] };
      }
      return a;
    });

    await updateProject(projectId, { agendas: updatedAgendas });
  };

  const updatePoint = async (projectId: string, agendaId: string, pointId: string, updates: Partial<Point>) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedAgendas = project.agendas.map(a => {
      if (a.id === agendaId) {
        const updatedPoints = a.points.map(pt => 
          pt.id === pointId ? { ...pt, ...updates } : pt
        );
        return { ...a, points: updatedPoints };
      }
      return a;
    });

    await updateProject(projectId, { agendas: updatedAgendas });
  };

  const deletePoint = async (projectId: string, agendaId: string, pointId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedAgendas = project.agendas.map(a => {
      if (a.id === agendaId) {
        const updatedPoints = a.points.filter(pt => pt.id !== pointId);
        return { ...a, points: updatedPoints };
      }
      return a;
    });

    await updateProject(projectId, { agendas: updatedAgendas });
  };

  const updateMultiplePoints = async (projectId: string, agendaId: string, pointIds: string[], updates: Partial<Point>) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedAgendas = project.agendas.map(a => {
      if (a.id === agendaId) {
        const updatedPoints = a.points.map(pt => 
          pointIds.includes(pt.id) ? { ...pt, ...updates } : pt
        );
        return { ...a, points: updatedPoints };
      }
      return a;
    });

    await updateProject(projectId, { agendas: updatedAgendas });
  };


  const value: ProjectsContextType = {
    projects,
    loading,
    addProject,
    updateProject,
    deleteProject,
    addAgenda,
    updateAgenda,
    deleteAgenda,
    addPoint,
    updatePoint,
    deletePoint,
    updateMultiplePoints,
  };

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
};
