from django.test import Client, TestCase
from django.urls import reverse

from .models import Note


class NoteModelTests(TestCase):
    def test_str_returns_title(self):
        note = Note.objects.create(title='خرید از سوپرمارکت', content='شیر و نان')
        self.assertEqual(str(note), 'خرید از سوپرمارکت')

    def test_pinned_notes_come_first(self):
        plain = Note.objects.create(title='عادی')
        pinned = Note.objects.create(title='مهم', is_pinned=True)
        self.assertEqual(list(Note.objects.all()), [pinned, plain])


class NoteApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.note = Note.objects.create(title='یادداشت اول', content='متن آزمایشی')

    def test_list_page_renders(self):
        response = self.client.get(reverse('notes:list'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'یادداشت اول')

    def test_create_note(self):
        response = self.client.post(
            reverse('notes:create'),
            {'title': 'یادداشت جدید', 'content': 'متن', 'color': 'blue', 'is_pinned': 'on'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['ok'])
        self.assertEqual(Note.objects.count(), 2)
        self.assertTrue(Note.objects.get(title='یادداشت جدید').is_pinned)

    def test_create_note_requires_title(self):
        response = self.client.post(
            reverse('notes:create'),
            {'title': '   ', 'content': 'متن'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('title', response.json()['errors'])
        self.assertEqual(Note.objects.count(), 1)

    def test_update_note(self):
        response = self.client.post(
            reverse('notes:update', args=[self.note.pk]),
            {'title': 'عنوان ویرایش‌شده', 'content': 'متن جدید', 'color': 'pink'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 200)
        self.note.refresh_from_db()
        self.assertEqual(self.note.title, 'عنوان ویرایش‌شده')
        self.assertEqual(self.note.color, 'pink')

    def test_delete_note(self):
        response = self.client.post(
            reverse('notes:delete', args=[self.note.pk]),
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Note.objects.filter(pk=self.note.pk).exists())

    def test_get_on_api_endpoints_is_not_allowed(self):
        response = self.client.get(reverse('notes:create'))
        self.assertEqual(response.status_code, 405)
