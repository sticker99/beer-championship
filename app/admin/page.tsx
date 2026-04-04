'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface BeerInput {
  id: string;
  name: string;
  brewery: string;
  type: string;
}

function SortableBeerCard({
  beer,
  index,
  beerEmoji,
  beersLength,
  updateBeer,
  removeBeer,
  moveBeer,
}: {
  beer: BeerInput;
  index: number;
  beerEmoji: string;
  beersLength: number;
  updateBeer: (index: number, field: keyof Omit<BeerInput, 'id'>, value: string) => void;
  removeBeer: (index: number) => void;
  moveBeer: (index: number, direction: 'up' | 'down') => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: beer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto' as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="animate-fade-in"
    >
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'stretch',
          background: isDragging ? 'rgba(245, 158, 11, 0.15)' : 'rgba(0,0,0,0.3)',
          padding: '20px',
          borderRadius: '16px',
          border: isDragging
            ? '2px solid var(--amber)'
            : '1px solid rgba(245, 158, 11, 0.1)',
          animationDelay: `${index * 0.05}s`,
          transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        {/* Drag handle + reorder buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            flexShrink: 0,
            minWidth: '44px',
          }}
        >
          <button
            type="button"
            onClick={() => moveBeer(index, 'up')}
            disabled={index === 0}
            style={{
              background: 'none',
              border: 'none',
              color: index === 0 ? 'rgba(254,243,199,0.15)' : 'var(--amber-light)',
              fontSize: '0.9rem',
              cursor: index === 0 ? 'default' : 'pointer',
              padding: '2px 6px',
              borderRadius: '6px',
              transition: 'all 0.2s',
            }}
          >
            ▲
          </button>
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: 'grab',
              touchAction: 'none',
              fontSize: '1.6rem',
              padding: '4px',
              color: 'rgba(254,243,199,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Drag to reorder"
          >
            {beerEmoji}
          </div>
          <button
            type="button"
            onClick={() => moveBeer(index, 'down')}
            disabled={index === beersLength - 1}
            style={{
              background: 'none',
              border: 'none',
              color: index === beersLength - 1 ? 'rgba(254,243,199,0.15)' : 'var(--amber-light)',
              fontSize: '0.9rem',
              cursor: index === beersLength - 1 ? 'default' : 'pointer',
              padding: '2px 6px',
              borderRadius: '6px',
              transition: 'all 0.2s',
            }}
          >
            ▼
          </button>
        </div>

        {/* Beer info inputs */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            className="input-field"
            placeholder={`Beer #${index + 1} Name`}
            value={beer.name}
            onChange={(e) => updateBeer(index, 'name', e.target.value)}
            required
            style={{ fontWeight: 700 }}
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              className="input-field"
              placeholder="Brewery"
              value={beer.brewery}
              onChange={(e) => updateBeer(index, 'brewery', e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              className="input-field"
              placeholder="Style (e.g. IPA)"
              value={beer.type}
              onChange={(e) => updateBeer(index, 'type', e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
        </div>

        {/* Remove button */}
        {beersLength > 1 && (
          <button
            type="button"
            onClick={() => removeBeer(index)}
            className="btn"
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#fca5a5',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: '1.2rem',
              alignSelf: 'center',
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

let nextId = 1;
function generateId() {
  return `beer-${Date.now()}-${nextId++}`;
}

export default function AdminPage() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState('');
  const [beers, setBeers] = useState<BeerInput[]>([
    { id: generateId(), name: '', brewery: '', type: '' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const addBeer = () => {
    setBeers([...beers, { id: generateId(), name: '', brewery: '', type: '' }]);
  };

  const updateBeer = (index: number, field: keyof Omit<BeerInput, 'id'>, value: string) => {
    const newBeers = [...beers];
    newBeers[index] = { ...newBeers[index], [field]: value };
    setBeers(newBeers);
  };

  const removeBeer = (index: number) => {
    setBeers(beers.filter((_, i) => i !== index));
  };

  const moveBeer = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= beers.length) return;
    setBeers(arrayMove(beers, index, newIndex));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = beers.findIndex((b) => b.id === active.id);
      const newIndex = beers.findIndex((b) => b.id === over.id);
      setBeers(arrayMove(beers, oldIndex, newIndex));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName || beers.some((b) => !b.name))
      return alert("Don't forget to name all your beers! 🍺");
    setIsSubmitting(true);
    try {
      // Strip the `id` field before sending — it's only for DnD
      const beersPayload = beers.map(({ name, brewery, type }) => ({ name, brewery, type }));
      const res = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sessionName, beers: beersPayload }),
      });
      const data = await res.json();
      if (data.sessionId) {
        router.push(`/admin/success?code=${data.sessionId}`);
      }
    } catch {
      alert('Something went wrong! Try again. 😢');
    }
    setIsSubmitting(false);
  };

  const beerEmojis = ['🍺', '🍻', '🥂', '🍷', '🥃', '🍾', '🫗', '🍹'];

  return (
    <main
      className="container"
      style={{ padding: '40px 20px', maxWidth: '800px', minHeight: '100vh' }}
    >
      <div style={{ textAlign: 'center', marginBottom: '32px' }} className="animate-fade-in">
        <span style={{ fontSize: '3rem' }}>🎯</span>
        <h1
          className="title-display"
          style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', marginTop: '8px' }}
        >
          Set Up Your Tasting
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '1.1rem' }}>
          Add the beers and let the battle begin!
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="glass-panel animate-fade-in"
        style={{ display: 'flex', flexDirection: 'column', gap: '28px', animationDelay: '0.15s' }}
      >
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 700, fontSize: '1.1rem' }}>
            🏷️ Event Name
          </label>
          <input
            className="input-field"
            placeholder="e.g. Friday Night IPA Throwdown"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            required
          />
        </div>

        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}
          >
            <h2 className="title-marker" style={{ fontSize: '1.5rem' }}>
              🍺 The Lineup
            </h2>
            <button
              type="button"
              onClick={addBeer}
              className="btn btn-secondary"
              style={{ padding: '10px 20px', fontSize: '0.95rem' }}
            >
              + Add Beer
            </button>
          </div>

          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            marginBottom: '14px',
            textAlign: 'center',
            opacity: 0.7,
          }}>
            ↕️ Drag the beer emoji or use ▲▼ to reorder
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={beers.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {beers.map((beer, index) => (
                  <SortableBeerCard
                    key={beer.id}
                    beer={beer}
                    index={index}
                    beerEmoji={beerEmojis[index % beerEmojis.length]}
                    beersLength={beers.length}
                    updateBeer={updateBeer}
                    removeBeer={removeBeer}
                    moveBeer={moveBeer}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <button
          type="submit"
          className="btn btn-primary animate-pulse"
          style={{ width: '100%', marginTop: '8px', fontSize: '1.3rem', padding: '18px' }}
          disabled={isSubmitting}
        >
          {isSubmitting ? '🔄 Creating...' : '🚀 Launch Tasting Session!'}
        </button>
      </form>
    </main>
  );
}
