import http.client

conn = http.client.HTTPSConnection("goodreads-books-ratings-reviews-metadata.p.rapidapi.com")

payload = "title=Harry%20Potter%20and%20the%20half-blood%20prince&page=1&author=&language=&publisher=&year="

headers = {
    'x-rapidapi-key': "b5183e0caemsh04c98983bc82ea4p1e87c3jsna421c5b40fb6",
    'x-rapidapi-host': "goodreads-books-ratings-reviews-metadata.p.rapidapi.com",
    'Content-Type': "application/x-www-form-urlencoded"
}

conn.request("POST", "/list", payload, headers)

res = conn.getresponse()
data = res.read()

print(data.decode("utf-8"))