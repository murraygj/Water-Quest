require 'webrick'
port = ENV['PORT'] || 8091
server = WEBrick::HTTPServer.new(
  :Port => port.to_i,
  :DocumentRoot => File.dirname(__FILE__)
)
trap('INT') { server.shutdown }
server.start
