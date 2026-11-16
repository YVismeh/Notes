from django.contrib import admin

from .models import Note


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ('title', 'color', 'is_pinned', 'created_at', 'updated_at')
    list_filter = ('color', 'is_pinned', 'created_at')
    search_fields = ('title', 'content')
    list_editable = ('is_pinned',)
