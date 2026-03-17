function handler(event) {
    var request = event.request;
    var host = request.headers.host.value;
    
    if (host === 'www.stockiq.tech') {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                'location': { value: 'https://stockiq.tech' + request.uri }
            }
        };
    }
    
    return request;
}