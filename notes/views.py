from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.template.loader import render_to_string
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from .forms import NoteForm
from .models import Note


@ensure_csrf_cookie
def note_list(request):
    """Render the single-page notes app."""
    return render(
        request,
        'note/note_list.html',
        {
            'notes': Note.objects.all(),
            'color_choices': Note.Color.choices,
        },
    )


def _card_html(note):
    return render_to_string('note/_note_card.html', {'note': note})


def _note_payload(note):
    return {
        'id': note.id,
        'title': note.title,
        'color': note.color,
        'is_pinned': note.is_pinned,
    }


def _error_response(form):
    return JsonResponse(
        {'ok': False, 'errors': {field: errors for field, errors in form.errors.items()}},
        status=400,
    )


@require_http_methods(['POST'])
def note_create(request):
    form = NoteForm(request.POST)
    if not form.is_valid():
        return _error_response(form)

    note = form.save()
    return JsonResponse(
        {'ok': True, 'note': _note_payload(note), 'html': _card_html(note)}
    )


@require_http_methods(['POST'])
def note_update(request, pk):
    note = get_object_or_404(Note, pk=pk)
    form = NoteForm(request.POST, instance=note)
    if not form.is_valid():
        return _error_response(form)

    note = form.save()
    return JsonResponse(
        {'ok': True, 'note': _note_payload(note), 'html': _card_html(note)}
    )


@require_http_methods(['POST'])
def note_delete(request, pk):
    note = get_object_or_404(Note, pk=pk)
    note.delete()
    return JsonResponse({'ok': True, 'id': pk})
