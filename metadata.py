import asyncio
from playwright.async_api import async_playwright
import requests
from bs4 import BeautifulSoup
import re
import subprocess
from ebooklib import epub
import os
from pathlib import Path


async def get_book_detail(page, label_text):
    # Wait for the <dt> with the desired label
    await page.wait_for_selector(f"dt:text('{label_text}')")
    # Extract corresponding <dd> sibling text
    return await page.eval_on_selector(
        f"dt:text('{label_text}') + dd",
        "element => element.textContent.trim()"
    )

async def fetch_details(url):
    async with async_playwright() as p:
        browser = await p.firefox.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url)

        # Expand the 'Book details' section
        await page.wait_for_selector("button:has-text('Book details')", state='visible')
        await page.click("button:has-text('Book details')")

        published_info = await get_book_detail(page, 'Published')
        isbn_info = await get_book_detail(page, 'ISBN')
        language = await get_book_detail(page, 'Language')

        await browser.close()
    return published_info, isbn_info, language

async def get_cover_url(title, country_code):
    async with async_playwright() as p:
        browser = await p.firefox.launch(headless=True)
        page = await browser.new_page()
        await page.goto('https://bendodson.com/projects/itunes-artwork-finder/', wait_until='networkidle')

        await page.wait_for_selector('select#entity', state='visible')
        await page.select_option('select#entity', value='ebook')

        await page.fill('input#query', title)

        await page.select_option('select#country', value=country_code)

        await page.click('input.submit[value="Get the artwork"]')
        await page.wait_for_selector('h3:text("Searching...")', state='hidden')

        # Wait for the container with results to appear
        await page.wait_for_selector('#results > div')

        # Get locator for the first book div inside #results
        first_book_div = page.locator('#results > div').first

        # Wait for the <p> inside that first book div (which has the links)
        await first_book_div.locator('p').wait_for()

        # Evaluate inside that first book div
        url = await first_book_div.evaluate("""
        div => {
            const p = div.querySelector('p');
            if (!p) return null;

            const highRes = Array.from(p.querySelectorAll('a'))
            .find(a => a.textContent.trim() === 'High Resolution');
            if (highRes && highRes.href) return highRes.href;

            const standardRes = Array.from(p.querySelectorAll('a'))
            .find(a => a.textContent.trim() === 'Standard Resolution');
            return standardRes ? standardRes.href : null;
        }
        """)

        await browser.close()
        return url

def download_image(url, filename):
    response = requests.get(url)
    response.raise_for_status()  # Raise error if request failed
    with open(filename, 'wb') as f:
        f.write(response.content)

def get_title(url):
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')

    title_element = soup.select_one('h1[data-testid="bookTitle"]')
    title = title_element.text.strip()
    return title

def get_metadata_dict(url, tmp_dir, debug=False):
    language_to_country_code = {
    'Dutch': 'nl',
    'English': 'us',
    'German': 'de',
    'French': 'fr',
    }

    published_info, isbn_info, language = asyncio.run(fetch_details(url))
    date_part, publisher_part = published_info.split(" by ", 1)
    language = language.split(';', 1)[0]
    
    isbn13 = re.search(r'\d{13}', isbn_info).group()

    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')

    title_element = soup.select_one('h1[data-testid="bookTitle"]')
    title = title_element.text.strip()

    author_element = soup.select_one('span[data-testid="name"]')
    author = author_element.text.strip()

    description_element = soup.select_one('span.Formatted')
    html = str(description_element)
    html = html.replace('<br/><br/> ', '\n\n')
    html = html.replace('<br/><br/>', '\n\n')
    html = html.replace('<br/> ', '\n')
    html = html.replace('<br/>', '\n')
    cleaned_soup = BeautifulSoup(html, 'html.parser')
    description = cleaned_soup.get_text()

    genres = []
    genre_spans = soup.select('span.BookPageMetadataSection__genreButton')

    for span in genre_spans[:4]:  # first 4 only
        label = span.select_one('span.Button__labelItem')
        if label:
            genres.append(label.get_text(strip=True))

    h3 = soup.select_one('h3.Text.Text__title3')

    series_name = None 
    book_number = None


    if h3:
        text = h3.get_text(strip=True) 
        match = re.match(r'(.+?)\s*#(\d+)', text)
        if match:
            series_name = match.group(1).strip()  
            book_number = match.group(2)          
        else:
            print("Non standard series pattern")
    else:
        print("Not part of series")

    rating_div = soup.select_one('div.RatingStatistics__rating')
    rating = rating_div.get_text(strip=True)
    rating = 2*float(rating)

    cover_file = tmp_dir / (title + '_cover.jpg')
    cover_url = asyncio.run(get_cover_url(title, language_to_country_code[language]))
    download_image(cover_url, cover_file)

    
    if debug:
        print(f'Title: {title}')
        print(f'Author: {author}')
        print(description)
        print(f'ISBN-13: {isbn13}')
        print(genres)
        print(f"Series name: {series_name}")
        print(f"Book number: {book_number}")
        print(f"Rating: {rating}")
        print(f"Date: {date_part}")
        print(f"Publisher: {publisher_part}")
        print(f"Language: {language}")

    metadata = {
        'Title': title,
        'Author': author,
        'Description': description,
        'ISBN': isbn13,
        'genre1': genres[0],
        'genre2': genres[1],
        'genre3': genres[2],
        'genre4': genres[3],
        'Rating': rating,
        'Date': date_part,
        'Publisher': publisher_part,
        'Language': language,
        'Cover_path': cover_file
    }

    if series_name:
        metadata['Serie'] = series_name

    if book_number:
        metadata['Serie ID'] = book_number

    return metadata

def set_metadata(file_path, metadata):
    env = os.environ.copy()
    env['TZ'] = 'UTC'

    cmd = ['ebook-meta', file_path]

    if 'Title' in metadata:
        cmd += ['--title', metadata['Title']]
    if 'Author' in metadata:
        cmd += ['--authors', metadata['Author']]
    if 'ISBN' in metadata:
        cmd += ['--isbn', metadata['ISBN']]
    if any(metadata.get(f'genre{i}') for i in range(1, 5)):
        genres = [metadata.get(f'genre{i}') for i in range(1, 5) if metadata.get(f'genre{i}')]
        cmd += ['--tags', ','.join(genres)]
    if 'Description' in metadata:
        cmd += ['--comments', metadata['Description']]
    if 'Serie' in metadata:
        cmd += ['--series', metadata['Serie']]
    if 'Serie ID' in metadata:
        cmd += ['--index', str(metadata['Serie ID'])]
    if 'Rating' in metadata:
        cmd += ['--rating', str(metadata['Rating'])]
    if 'Publisher' in metadata:
        cmd += ['--publisher', metadata['Publisher']]
    if 'Date' in metadata:
        cmd += ['--date', metadata['Date']]
    if 'Language' in metadata:
        cmd += ['--language', metadata['Language']]
    if 'Cover_path' in metadata:
        cmd += ['--cover', metadata['Cover_path']]

    
    subprocess.run(cmd, check=True, env=env)
    os.remove(metadata['Cover_path'])

def metadata(url, book_path, tmp_dir):
    meta_dict = get_metadata_dict(url, tmp_dir)
    ebook = epub.read_epub(book_path)
    ebook.metadata.clear()
    epub.write_epub(book_path, ebook)
    set_metadata(book_path, meta_dict)